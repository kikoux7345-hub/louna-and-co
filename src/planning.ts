export type Intervention = Readonly<{ id: string; client?: string; adresse: string; debut: string; fin: string; minutes: number }>
export function nomIntervention(i: { readonly client?: string }, index: number) { return i.client?.trim() || `Intervention ${index + 1}` }
export type Planning = Readonly<{ domicile: string; interventions: readonly Intervention[] }>
export const clePlanning = 'louna-planning-v1'
export const planningInitial: Planning = Object.freeze({
  // Lieu public de démonstration : renseigner son domicile dans l’éditeur.
  domicile: '25 avenue André Malraux, 37000 Tours',
  interventions: Object.freeze([
    Object.freeze({ id: 'intervention-1', adresse: '1 rue des Minimes, 37000 Tours', debut: '09:00', fin: '10:00', minutes: 60 }),
    Object.freeze({ id: 'intervention-2', adresse: '18 place François Sicard, 37000 Tours', debut: '10:30', fin: '11:15', minutes: 45 }),
    Object.freeze({ id: 'intervention-3', adresse: '2 bis avenue André Malraux, 37000 Tours', debut: '14:00', fin: '15:30', minutes: 90 }),
  ]),
})
const objet = (p: unknown): p is Record<string, unknown> => !!p && typeof p === 'object' && !Array.isArray(p)
const adresseValide = (p: unknown): p is string => typeof p === 'string' && p.trim().length >= 5 && p.length <= 300
const heureValide = (p: unknown): p is string => typeof p === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(p)
export function validerPlanning(donnees: unknown): Planning {
  if (!objet(donnees) || !adresseValide(donnees.domicile)) throw new Error('Indique une adresse de départ complète (numéro, rue et ville).')
  if (!Array.isArray(donnees.interventions) || donnees.interventions.length > 50) throw new Error('Le planning doit contenir au maximum 50 interventions.')
  const ids = new Set<string>()
  const interventions: Intervention[] = donnees.interventions.map((p: unknown, index: number) => {
    const nom = `Intervention ${index + 1}`
    if (!objet(p) || typeof p.id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(p.id) || ids.has(p.id)) throw new Error(`${nom} : identifiant invalide ou dupliqué.`)
    ids.add(p.id)
    if (p.client !== undefined && (typeof p.client !== 'string' || p.client.trim().length > 80)) throw new Error(`${nom} : le nom du client doit contenir au maximum 80 caractères.`)
    if (!adresseValide(p.adresse)) throw new Error(`${nom} : indique une adresse complète.`)
    if (!heureValide(p.debut) || !heureValide(p.fin) || p.fin <= p.debut) throw new Error(`${nom} : la fin doit être après le début, dans la même journée.`)
    if (typeof p.minutes !== 'number' || !Number.isInteger(p.minutes) || p.minutes < 1 || p.minutes > 1440) throw new Error(`${nom} : la durée obligatoire doit être comprise entre 1 et 1440 minutes.`)
    const enMinutes = (heure: string) => Number(heure.slice(0, 2)) * 60 + Number(heure.slice(3))
    if (p.minutes > enMinutes(p.fin) - enMinutes(p.debut)) throw new Error(`${nom} : le créneau officiel est plus court que la durée obligatoire. Vérifie les valeurs saisies.`)
    return Object.freeze({ id: p.id, client: typeof p.client === 'string' ? p.client.trim() : '', adresse: p.adresse.trim(), debut: p.debut, fin: p.fin, minutes: p.minutes })
  })
  interventions.sort((a, b) => a.debut.localeCompare(b.debut))
  for (let i = 1; i < interventions.length; i++) {
    if (interventions[i].debut < interventions[i - 1].fin) throw new Error('Deux interventions se chevauchent. Vérifie leurs horaires officiels.')
  }
  return Object.freeze({ domicile: donnees.domicile.trim(), interventions: Object.freeze(interventions) })
}
export function chargerPlanning(): { planning: Planning; erreur: string } {
  try {
    const brut = localStorage.getItem(clePlanning)
    return { planning: brut === null ? planningInitial : validerPlanning(JSON.parse(brut)), erreur: '' }
  } catch {
    return { planning: planningInitial, erreur: 'Le planning sauvegardé est illisible ou inaccessible. Le planning de départ est affiché ; vérifie-le dans « Modifier mon planning » avant de pointer.' }
  }
}
export function enregistrerPlanning(donnees: unknown): Planning {
  const planning = validerPlanning(donnees)
  // Sauvegarder avant de remplacer le planning affiché : un échec reste visible.
  try {
    localStorage.setItem(clePlanning, JSON.stringify(planning))
  } catch (cause) {
    throw new Error('Sauvegarde impossible. Le planning précédent reste inchangé. Garde cet écran ouvert et réessaie.', { cause })
  }
  return planning
}
export function nouvelId() {
  // Le téléphone peut ouvrir le serveur en HTTP, sans crypto.randomUUID.
  return `intervention-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
}
