import { planningInitial, validerPlanning, clePlanning } from './planning'
import type { Planning } from './planning'
import { jourParis } from './motis'
export type Pointage = { debut: number | null; fin: number | null }
export type EntreeJour = { planning: Planning; pointages: Record<string, Pointage>; importe?: boolean }
export type Journal = { version: 2; jours: Record<string, EntreeJour> }
export const cleJournal = 'louna-calendrier-v2'
const objet = (p: unknown): p is Record<string, unknown> => !!p && typeof p === 'object' && !Array.isArray(p)
export function dateValide(jour: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(jour) && Number.isFinite(Date.parse(`${jour}T12:00:00Z`))
    && new Date(`${jour}T12:00:00Z`).toISOString().slice(0, 10) === jour
}
export function autreJour(jour: string, decalage: number) {
  const date = new Date(`${jour}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + decalage)
  return date.toISOString().slice(0, 10)
}
function validerPointages(brut: unknown): Record<string, Pointage> {
  if (!objet(brut)) throw new Error('Pointages illisibles.')
  const resultat: Record<string, Pointage> = Object.create(null)
  const temps = (t: unknown): t is number => typeof t === 'number' && Number.isFinite(t) && t >= 0 && t <= 8640000000000000
  for (const [id, p] of Object.entries(brut)) {
    if (!/^[a-zA-Z0-9-]{1,100}$/.test(id) || !objet(p)
      || (p.debut !== null && !temps(p.debut))
      || (p.fin !== null && (!temps(p.fin) || !temps(p.debut) || p.fin < p.debut))) throw new Error('Pointage invalide.')
    resultat[id] = { debut: p.debut as number | null, fin: p.fin as number | null }
  }
  return resultat
}
export function validerJournal(brut: unknown): Journal {
  if (!objet(brut) || brut.version !== 2 || !objet(brut.jours)) throw new Error('Calendrier illisible.')
  const jours: Journal['jours'] = Object.create(null)
  for (const [jour, entree] of Object.entries(brut.jours)) {
    if (!dateValide(jour) || !objet(entree)) throw new Error('Journée invalide.')
    const pointages = validerPointages(entree.pointages)
    for (const p of Object.values(pointages)) {
      if (p.debut !== null && jourParis(new Date(p.debut)) !== jour) throw new Error('Un pointage ne correspond pas à sa journée.')
    }
    jours[jour] = { planning: validerPlanning(entree.planning), pointages, ...(entree.importe === true ? { importe: true } : {}) }
  }
  return { version: 2, jours }
}
export function chargerJournal(aujourdhui = jourParis()): { journal: Journal; erreur: string; bloque: boolean } {
  try {
    const nouveau = localStorage.getItem(cleJournal)
    if (nouveau !== null) return { journal: validerJournal(JSON.parse(nouveau)), erreur: '', bloque: false }
    const brutPlanning = localStorage.getItem(clePlanning)
    const planning = brutPlanning === null ? planningInitial : validerPlanning(JSON.parse(brutPlanning))
    const ancien = localStorage.getItem('louna-pointages-v1')
    const pointages = ancien === null ? {} : validerPointages(JSON.parse(ancien))
    const journal: Journal = { version: 2, jours: { [aujourdhui]: { planning, pointages: {} } } }
    for (const [id, p] of Object.entries(pointages)) {
      const jour = p.debut === null ? aujourdhui : jourParis(new Date(p.debut))
      journal.jours[jour] ??= { planning: validerPlanning(planning), pointages: {}, importe: true }
      journal.jours[jour].pointages[id] = p
    }
    return { journal, erreur: ancien || brutPlanning ? 'Ancien planning récupéré. Les pointages ont été répartis selon leur date de début. Pour ces anciennes dates, le planning affiché est celui récupéré lors de la mise à jour.' : '', bloque: false }
  } catch {
    return { journal: { version: 2, jours: {} }, erreur: 'La sauvegarde est illisible ou inaccessible. Les anciennes données sont conservées ; aucune modification ne sera enregistrée pour éviter de les écraser.', bloque: true }
  }
}
export function lireJour(journal: Journal, jour: string): EntreeJour {
  if (!dateValide(jour)) throw new Error('Date invalide.')
  if (journal.jours[jour]) return journal.jours[jour]
  const dates = Object.keys(journal.jours).sort().reverse()
  const proche = dates.find(d => d <= jour) ?? dates[0]
  return { planning: { domicile: proche ? journal.jours[proche].planning.domicile : planningInitial.domicile, interventions: [] }, pointages: {} }
}
export function remplacerJour(journal: Journal, jour: string, entree: EntreeJour): Journal {
  return validerJournal({ ...journal, jours: { ...journal.jours, [jour]: { ...entree, ...(journal.jours[jour]?.importe ? { importe: true } : {}) } } })
}
export function copierJour(journal: Journal, source: string, destination: string): Journal {
  if (source === destination) throw new Error('Choisis une autre date pour la copie.')
  if (!dateValide(destination)) throw new Error('Choisis une date valide.')
  const depuis = journal.jours[source]
  if (!depuis) throw new Error('Cette journée n’est pas encore enregistrée.')
  const vers = journal.jours[destination]
  if (vers && (vers.planning.interventions.length > 0 || Object.keys(vers.pointages).length > 0)) throw new Error('Cette date contient déjà un planning ou des pointages. La copie ne l’a pas remplacée.')
  return remplacerJour(journal, destination, { planning: validerPlanning(depuis.planning), pointages: {} })
}
export function enregistrerJournal(journal: Journal) {
  const valide = validerJournal(journal)
  try { localStorage.setItem(cleJournal, JSON.stringify(valide)) }
  catch (cause) { throw new Error('Sauvegarde impossible. La modification n’a pas été appliquée. Garde cette page ouverte et réessaie.', { cause }) }
  return valide
}
