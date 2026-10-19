import { instantParis } from './motis'
export type PointageCorrige = { debut: number | null; fin: number | null }

export function champHeure(valeur: number | null): string {
  if (valeur === null) return ''
  const parties = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(valeur)
  const p = Object.fromEntries(parties.map(({type, value}) => [type, value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`
}
function convertir(champ: string, ancien: number | null): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(champ)) throw new Error('Indique une date et une heure valides.')
  const complet = champ.length === 16 ? `${champ}:00` : champ
  // Conserver les millisecondes du pointage si ce champ n’a pas été modifié.
  if (ancien !== null && champHeure(ancien) === complet) return ancien
  const secondes = Number(complet.slice(17))
  if (secondes > 59) throw new Error('Les secondes doivent être comprises entre 00 et 59.')
  const valeur = Date.parse(instantParis(complet.slice(0, 10), complet.slice(11, 16))) + secondes * 1000
  if (!Number.isFinite(valeur) || champHeure(valeur) !== complet) throw new Error('Cette date ou cette heure n’existe pas dans le fuseau de Tours. Vérifie la saisie.')
  return valeur
}
export function validerCorrection(debut: string, fin: string, ancien: PointageCorrige, maintenant: number): PointageCorrige {
  if (!debut) throw new Error('Le début réel est obligatoire.')
  const d = convertir(debut, ancien.debut)
  const f = fin ? convertir(fin, ancien.fin) : null
  if (d > maintenant || (f !== null && f > maintenant)) throw new Error('Les heures réelles ne peuvent pas être dans le futur.')
  if (f !== null && f < d) throw new Error('La fin réelle doit être après le début réel, ou à la même heure.')
  return {debut: d, fin: f}
}
