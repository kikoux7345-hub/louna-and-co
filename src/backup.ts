import { cleJournal, validerJournal } from './journal'
import type { Journal } from './journal'
export const cleSecours = 'louna-avant-restauration-v1'
export const tailleMax = 5 * 1024 * 1024
export function creerSauvegarde(journal: Journal) {
  return JSON.stringify({ format: 'louna-and-co', version: 1, exporteLe: new Date().toISOString(), journal: validerJournal(journal) }, null, 2)
}
export function lireSauvegarde(texte: string): Journal {
  try {
    const brut = JSON.parse(texte)
    if (brut?.format === 'louna-and-co') {
      if (brut.version !== 1) throw new Error()
      return validerJournal(brut.journal)
    }
    return validerJournal(brut)
  } catch (cause) {
    throw new Error('Fichier invalide ou version non prise en charge. Aucune donnée n’a été modifiée.', { cause })
  }
}
export function resumeSauvegarde(journal: Journal) {
  const dates = Object.keys(journal.jours).sort()
  return { jours: dates.length, debut: dates[0], fin: dates[dates.length - 1],
    interventions: Object.values(journal.jours).reduce((n, j) => n + j.planning.interventions.length, 0),
    pointages: Object.values(journal.jours).reduce((n, j) => n + Object.values(j.pointages).filter(p => p.debut !== null).length, 0),
  }
}
export function restaurerSauvegarde(importe: Journal, actuel: Journal): Journal {
  const valide = validerJournal(importe)
  // La copie de secours doit réussir AVANT toute écriture du calendrier importé.
  try {
    const original = localStorage.getItem(cleJournal) ?? creerSauvegarde(actuel)
    localStorage.setItem(cleSecours, original)
    localStorage.setItem(cleJournal, JSON.stringify(valide))
  } catch (cause) {
    throw new Error('Restauration impossible : stockage indisponible ou plein. Le calendrier actuel reste inchangé.', { cause })
  }
  return valide
}
