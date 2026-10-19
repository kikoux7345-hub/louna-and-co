import { useEffect, useRef, useState } from 'react'
import { champHeure, validerCorrection } from './correction'
import type { PointageCorrige } from './correction'

export default function CorrectionHeures({ adresse, numero, client, pointage, minutes, surEnregistrer, surAnnuler }: {
  adresse: string; numero: number; client?: string; pointage: PointageCorrige; minutes: number;
  surEnregistrer: (p: PointageCorrige) => void; surAnnuler: () => void;
}) {
  const [debut, setDebut] = useState(() => champHeure(pointage.debut))
  const [fin, setFin] = useState(() => champHeure(pointage.fin))
  const [erreur, setErreur] = useState('')
  const titre = useRef<HTMLHeadingElement>(null)
  useEffect(() => { titre.current?.focus() }, [])
  return <main>
    <h1 ref={titre} tabIndex={-1}>✏️ Corriger les heures réelles</h1>
    <h2>{client || `Intervention ${numero}`}</h2><p>{adresse}</p>
    <form className="editeur-planning" onSubmit={e => {
      e.preventDefault()
      try {
        surEnregistrer(validerCorrection(debut, fin, pointage, Date.now()))
      } catch (e) {
        setErreur(e instanceof Error ? e.message : 'Correction impossible.')
      }
    }}>
      <label>Début réel · heure de Tours
        <input type="datetime-local" step={1} required value={debut} onChange={e => { setDebut(e.target.value); setErreur('') }} />
      </label>
      <label>Fin réelle · heure de Tours
        <input type="datetime-local" step={1} value={fin} onChange={e => { setFin(e.target.value); setErreur('') }} />
      </label>
      <p className="note">Fin vide = intervention en cours · {minutes} min obligatoires.</p>
      <details className="aide-stockage"><summary>Aide</summary><p>Les horaires officiels restent inchangés. La durée réelle sera recalculée. Effacer une fin déjà enregistrée remettra l’intervention en cours.</p></details>
      {erreur && <p className="avertissement" role="alert">{erreur}</p>}
      <div className="actions">
        <button type="submit">Enregistrer</button>
        <button type="button" className="bouton-secondaire" onClick={surAnnuler}>Annuler</button>
      </div>
    </form>
  </main>
}
