import { calculer, instantParis, jourParis } from './motis'
import type { Itineraire, Lieu } from './motis'
import type { Planning, Intervention } from './planning'
import { nomIntervention } from './planning'

export type PointagesJournee = Record<string, { debut: number | null; fin: number | null }>
export type RouteJournee = {
  depart: string; arrivee: string; titre: string; itineraire?: Itineraire; erreur?: string;
  libreAvant: number; margeArrivee: number; retard: number;
}
export type InterventionJournee = {
  intervention: Intervention; debutPrevu: number; finPrevue: number;
  debutReel?: number; finReelle?: number; retard: number;
}
export type ResultatJournee = { routes: RouteJournee[]; interventions: InterventionJournee[]; calculeA: string }

export function estimerIntervention(intervention: Intervention, jour: string, arrivee: number | undefined, p?: { debut: number | null; fin: number | null }): InterventionJournee {
  const officiel = Date.parse(instantParis(jour, intervention.debut))
  const finOfficielle = Date.parse(instantParis(jour, intervention.fin))
  const memeJour = (t: number | null | undefined) => t != null && jourParis(new Date(t)) === jour ? t : undefined
  const debutReel = memeJour(p?.debut)
  const finReelle = debutReel !== undefined && p?.fin != null ? p.fin : undefined
  const debutPrevu = debutReel ?? Math.max(officiel, arrivee ?? officiel)
  const finPrevue = finReelle ?? Math.max(finOfficielle, debutPrevu + intervention.minutes * 60000)
  return { intervention, debutPrevu, finPrevue, debutReel, finReelle, retard: Math.max(0, debutPrevu - officiel) }
}

export async function calculerJournee(
  planning: Planning, jour: string, lieux: ReadonlyMap<string, Lieu>, pointages: PointagesJournee,
  avecPointages: boolean, signal: AbortSignal, progression: (texte: string) => void,
  routeur: typeof calculer = calculer,
): Promise<ResultatJournee> {
  const routes: RouteJournee[] = []
  const interventions: InterventionJournee[] = []
  const liste = planning.interventions
  for (let i = 0; i <= liste.length && liste.length > 0; i++) {
    signal.throwIfAborted()
    progression(`Calcul du trajet ${i + 1} sur ${liste.length + 1}…`)
    const depart = i === 0 ? planning.domicile : liste[i - 1].adresse
    const arrivee = i === liste.length ? planning.domicile : liste[i].adresse
    const precedent = interventions[i - 1]
    const reference = i === 0 ? Date.parse(instantParis(jour, liste[0].debut)) : precedent.finPrevue
    const limite = i < liste.length ? Date.parse(instantParis(jour, liste[i].debut)) : undefined
    const route: RouteJournee = {
      depart, arrivee, titre: i === 0 ? `Maison → ${nomIntervention(liste[0], 0)}` : i === liste.length ? `${nomIntervention(liste[i - 1], i - 1)} → Maison` : `${nomIntervention(liste[i - 1], i - 1)} → ${nomIntervention(liste[i], i)}`,
      libreAvant: 0, margeArrivee: 0, retard: 0,
    }
    try {
      const de = lieux.get(depart), vers = lieux.get(arrivee)
      if (!de || !vers) throw new Error('Vérifie les adresses avant de calculer.')
      const controle = new AbortController()
      const annuler = () => controle.abort()
      signal.addEventListener('abort', annuler, { once: true })
      const delai = setTimeout(annuler, 30000)
      let resultats: Itineraire[]
      try {
        resultats = await routeur(de, vers, new Date(reference).toISOString(), i === 0, controle.signal, limite)
      } finally {
        clearTimeout(delai)
        signal.removeEventListener('abort', annuler)
      }
      signal.throwIfAborted()
      if (!resultats.length) throw new Error('Aucun itinéraire trouvé à cette date et cette heure. Les données peuvent être incomplètes.')
      route.itineraire = resultats[0]
      const fin = Date.parse(route.itineraire.endTime)
      route.libreAvant = i === 0 ? 0 : Math.max(0, Date.parse(route.itineraire.startTime) - reference)
      route.margeArrivee = limite === undefined ? 0 : Math.max(0, limite - fin)
      route.retard = limite === undefined ? 0 : Math.max(0, fin - limite)
    } catch (e) {
      signal.throwIfAborted()
      route.erreur = e instanceof Error ? e.message : 'Calcul de ce trajet impossible.'
    }
    routes.push(route)
    if (i < liste.length) interventions.push(estimerIntervention(liste[i], jour,
      route.itineraire ? Date.parse(route.itineraire.endTime) : undefined,
      avecPointages ? pointages[liste[i].id] : undefined))
  }
  return { routes, interventions, calculeA: new Date().toISOString() }
}
