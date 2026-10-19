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

async function lire(chemin: string, params: URLSearchParams, signal: AbortSignal): Promise<unknown> {
  const url = `${serveur}${chemin}?${params}`
  const sauvegarde = cache.get(url)
  if (sauvegarde && sauvegarde.expiration > Date.now()) return sauvegarde.valeur
  let reponse: Response
  try {
    reponse = await fetch(url, { signal, referrerPolicy: 'origin', headers: { Accept: 'application/json' } })
  } catch (e) {
    if (signal.aborted) throw e
    throw new Error('Connexion à MOTIS impossible. Vérifie Internet, puis réessaie. Aucun trajet n’a été inventé.', { cause: e })
  }
  if (!reponse.ok) throw new Error(reponse.status === 429
    ? 'Le service est très sollicité. Réessaie dans quelques minutes.'
    : `MOTIS ne peut pas répondre pour cette recherche (code ${reponse.status}).`)
  const valeur: unknown = await reponse.json()
  cache.set(url, { valeur, expiration: Date.now() + (chemin.includes('geocode') ? 86400000 : 60000) })
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
export async function calculer(depart: Lieu, arrivee: Lieu, time: string, arriveBy: boolean, signal: AbortSignal): Promise<Itineraire[]> {
  const params = new URLSearchParams({
    fromPlace: `${depart.lat},${depart.lon}`, toPlace: `${arrivee.lat},${arrivee.lon}`,
    time, arriveBy: String(arriveBy), numItineraries: '3', language: 'fr',
    preTransitModes: 'WALK', postTransitModes: 'WALK', directModes: 'WALK',
  })
  const brut = await lire('/api/v6/plan', params, signal)
  if (!brut || typeof brut !== 'object') throw new Error('Réponse MOTIS invalide.')
  const p = brut as { itineraries?: unknown[]; direct?: unknown[] }
  if (!Array.isArray(p.itineraries) || !Array.isArray(p.direct)) throw new Error('Format de réponse MOTIS non reconnu.')
  const instant = Date.parse(time)
  const resultats = [...p.itineraries, ...p.direct].filter(itineraireValide)
    .filter(i => !i.legs.some(l => l.cancelled))
    .filter(i => arriveBy ? Date.parse(i.endTime) <= instant : Date.parse(i.startTime) >= instant)
  resultats.sort((a, b) => arriveBy
    ? Date.parse(b.startTime) - Date.parse(a.startTime)
    : Date.parse(a.endTime) - Date.parse(b.endTime))
  return resultats.slice(0, 3)
}
