export const contact = 'kikoux7345@gmail.com'
const serveur = 'https://api.transitous.org'
const cache = new Map<string, { expiration: number; valeur: unknown }>()
export type Lieu = { name: string; lat: number; lon: number; street?: string; houseNumber?: string; zip?: string; areas?: { name: string }[] }
type PointEtape = { name: string; lat?: number; lon?: number }
export type Etape = {
  mode: string; startTime: string; endTime: string; duration: number;
  from: PointEtape; to: PointEtape; realTime: boolean;
  routeShortName?: string; displayName?: string; headsign?: string; cancelled?: boolean;
}
export type Itineraire = { duration: number; startTime: string; endTime: string; transfers: number; legs: Etape[] }

export function dureeMarche(itineraire: Itineraire): number {
  return itineraire.legs.reduce((total, etape) => total + (etape.mode === 'WALK' ? Math.max(0, etape.duration) : 0), 0)
}

export function lienMarche(etape: Etape): string | null {
  const valide = (p: PointEtape) => typeof p.lat === 'number' && typeof p.lon === 'number'
    && Number.isFinite(p.lat) && Number.isFinite(p.lon)
    && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180
  if (etape.mode !== 'WALK' || !valide(etape.from) || !valide(etape.to)) return null
  return `https://www.google.com/maps/dir/?${new URLSearchParams({
    api: '1', origin: `${etape.from.lat},${etape.from.lon}`,
    destination: `${etape.to.lat},${etape.to.lon}`, travelmode: 'walking',
  })}`
}

async function lire(chemin: string, params: URLSearchParams, signal: AbortSignal, origine = serveur): Promise<unknown> {
  const url = `${origine}${chemin}?${params}`
  const sauvegarde = cache.get(url)
  if (sauvegarde && sauvegarde.expiration > Date.now()) return sauvegarde.valeur
  let reponse: Response
  try {
    reponse = await fetch(url, { signal, referrerPolicy: 'origin', headers: { Accept: 'application/json' } })
  } catch (e) {
    if (signal.aborted) throw e
    if (origine !== serveur) throw new Error('Recherche d’adresse IGN indisponible. Réessaie.', { cause: e })
    throw new Error('Connexion à MOTIS impossible. Vérifie Internet, puis réessaie. Aucun trajet n’a été inventé.', { cause: e })
  }
  if (!reponse.ok && origine !== serveur) throw new Error('Recherche d’adresse IGN indisponible. Réessaie.')
  if (!reponse.ok) throw new Error(reponse.status === 429
    ? 'Le service est très sollicité. Réessaie dans quelques minutes.'
    : `MOTIS ne peut pas répondre pour cette recherche (code ${reponse.status}).`)
  const valeur: unknown = await reponse.json()
  cache.set(url, { valeur, expiration: Date.now() + (chemin.includes('geocod') ? 86400000 : 60000) })
  return valeur
}
export function jourParis(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
}
// Conversion explicite : les horaires officiels sont toujours ceux de Tours,
// même si le navigateur utilise un autre fuseau horaire.
export function instantParis(jour: string, heure: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour) || !/^\d{2}:\d{2}$/.test(heure)) throw new Error('Choisis une date et une heure valides.')
  const cible = Date.parse(`${jour}T${heure}:00Z`)
  if (!Number.isFinite(cible)) throw new Error('Date invalide.')
  let instant = cible
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(instant)
    const p = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
    const paris = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`)
    instant += cible - paris
  }
  return new Date(instant).toISOString()
}
export function heureParis(instant: string) {
  return new Date(instant).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
export function libelleLieu(lieu: Lieu) {
  return [lieu.houseNumber, lieu.street || lieu.name, lieu.zip, lieu.areas?.find(a => a.name.toLowerCase() === 'tours')?.name].filter(Boolean).join(' ')
}
export async function chercherLieux(adresse: string, signal: AbortSignal): Promise<Lieu[]> {
  const donnees = await lire('/api/v1/geocode', new URLSearchParams({
    text: adresse, language: 'fr', place: '47.394,0.689', numResults: '5', type: 'ADDRESS,PLACE',
  }), signal)
  if (!Array.isArray(donnees)) throw new Error('Réponse de recherche d’adresse invalide.')
  const lieux = donnees.filter((p): p is Lieu => p && typeof p.name === 'string'
    && typeof p.lat === 'number' && typeof p.lon === 'number'
    && Number.isFinite(p.lat) && Number.isFinite(p.lon)
    && p.lat > 47.32 && p.lat < 47.48 && p.lon > 0.60 && p.lon < 0.78)
  const numero = adresse.trim().match(/^(\d+\s*(?:bis|ter|quater)?)(?=\s|,|$)/i)?.[1]
  if (numero) {
    const normaliser = (valeur: string) => valeur.toLowerCase().replace(/\s/g, '')
    const correspond = (lieu: Lieu) => typeof lieu.houseNumber === 'string'
      && normaliser(lieu.houseNumber) === normaliser(numero)
    const precis = lieux.filter(correspond)
    if (precis.length) return precis
    // La rue seule ne suffit pas pour calculer le bon arrêt de descente.
    const brut = await lire('/geocodage/search', new URLSearchParams({
      q: adresse, limit: '5', citycode: '37261',
    }), signal, 'https://data.geopf.fr')
    const collection = brut as {features?: {geometry?: {type?: string; coordinates?: unknown[]}; properties?: {
      type?: string; score?: number; housenumber?: string; street?: string;
      label?: string; postcode?: string; city?: string; citycode?: string;
    }}[]}
    const adresses: Lieu[] = []
    if (Array.isArray(collection?.features)) for (const element of collection.features) {
      const p = element?.properties, g = element?.geometry
      if (!p || g?.type !== 'Point' || !Array.isArray(g.coordinates)) continue
      const [lon, lat] = g.coordinates
      if (p.type !== 'housenumber' || typeof p.score !== 'number' || p.score < 0.8
        || p.citycode !== '37261' || typeof p.label !== 'string'
        || typeof p.housenumber !== 'string' || normaliser(p.housenumber) !== normaliser(numero)
        || typeof lat !== 'number' || typeof lon !== 'number'
        || !Number.isFinite(lat) || !Number.isFinite(lon)
        || lat <= 47.32 || lat >= 47.48 || lon <= 0.60 || lon >= 0.78) continue
      adresses.push({name:p.label, lat, lon, houseNumber:p.housenumber, street:p.street,
        zip:p.postcode, areas:[{name:p.city || 'Tours'}]})
    }
    if (adresses.length) return adresses
    throw new Error('Numéro de rue non confirmé. Vérifie l’adresse : aucun point au milieu de la rue n’a été utilisé.')
  }
  if (!lieux.length) throw new Error(`Adresse non trouvée dans Tours : ${adresse}. Aucun point approximatif n’a été choisi.`)
  return lieux
}
function itineraireValide(p: unknown): p is Itineraire {
  if (!p || typeof p !== 'object') return false
  const i = p as Itineraire
  return Number.isFinite(i.duration) && i.duration >= 0
    && Number.isFinite(Date.parse(i.startTime)) && Number.isFinite(Date.parse(i.endTime))
    && Date.parse(i.endTime) >= Date.parse(i.startTime)
    && Array.isArray(i.legs) && i.legs.length > 0 && i.legs.every(l =>
      l && typeof l.mode === 'string' && typeof l.from?.name === 'string'
      && typeof l.to?.name === 'string' && Number.isFinite(l.duration)
      && Number.isFinite(Date.parse(l.startTime)) && Number.isFinite(Date.parse(l.endTime)))
}
export async function calculer(depart: Lieu, arrivee: Lieu, time: string, arriveBy: boolean, signal: AbortSignal, limiteArrivee?: number): Promise<Itineraire[]> {
  const params = new URLSearchParams({
    fromPlace: `${depart.lat},${depart.lon}`, toPlace: `${arrivee.lat},${arrivee.lon}`,
    time, arriveBy: String(arriveBy), numItineraries: '6', language: 'fr',
    preTransitModes: 'WALK', postTransitModes: 'WALK', directModes: 'WALK',
  })
  const instant = Date.parse(time)
  const charger = async (recherche: URLSearchParams): Promise<Itineraire[]> => {
    const brut = await lire('/api/v6/plan', recherche, signal)
    if (!brut || typeof brut !== 'object') throw new Error('Réponse MOTIS invalide.')
    const p = brut as { itineraries?: unknown[]; direct?: unknown[] }
    if (!Array.isArray(p.itineraries) || !Array.isArray(p.direct)) throw new Error('Format de réponse MOTIS non reconnu.')
    return [...p.itineraries, ...p.direct].filter(itineraireValide)
      .filter(i => !i.legs.some(l => l.cancelled))
      .filter(i => arriveBy ? Date.parse(i.endTime) <= instant : Date.parse(i.startTime) >= instant)
  }
  const resultats = await charger(params)
  // Une recherche complémentaire peut retrouver les transports écartés par
  // le calcul le plus rapide, en limitant chaque marche d'accès à cinq minutes.
  if (!resultats.length || resultats.every(i => dureeMarche(i) > 300)) {
    const courteMarche = new URLSearchParams(params)
    courteMarche.set('maxPreTransitTime', '300')
    courteMarche.set('maxPostTransitTime', '300')
    try {
      resultats.push(...await charger(courteMarche))
    } catch (erreur) {
      signal.throwIfAborted()
      if (!resultats.length) throw erreur
      // Les premiers résultats restent utilisables si la variante échoue.
    }
  }
  return classerMoinsDeMarche(resultats, arriveBy, limiteArrivee).slice(0, 3)
}

export function classerMoinsDeMarche(itineraires: Itineraire[], arriveBy: boolean, limiteArrivee?: number): Itineraire[] {
  if (!itineraires.length) return []
  const horaire = (i: Itineraire) => arriveBy ? -Date.parse(i.startTime) : Date.parse(i.endTime)
  const ponctuels = limiteArrivee !== undefined && Number.isFinite(limiteArrivee)
    ? itineraires.filter(i => Date.parse(i.endTime) <= limiteArrivee) : []
  if (ponctuels.length) itineraires = ponctuels
  const meilleurHoraire = Math.min(...itineraires.map(horaire))
  const marge = 2 * 60 * 1000
  const groupe = (i: Itineraire) => Number(horaire(i) > meilleurHoraire + marge)
  const uniques = [...new Map(itineraires.map(i => [JSON.stringify([
    i.startTime, i.endTime, i.legs.map(l => [l.mode, l.routeShortName, l.from.name, l.to.name, l.startTime, l.endTime, l.duration]),
  ]), i])).values()]
  return uniques.sort((a, b) => groupe(a) - groupe(b)
    || (groupe(a) === 0 ? dureeMarche(a) - dureeMarche(b) : 0)
    || horaire(a) - horaire(b) || dureeMarche(a) - dureeMarche(b)
    || a.transfers - b.transfers || a.duration - b.duration)
}
