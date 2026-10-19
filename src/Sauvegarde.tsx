import { useState } from 'react'
import type { Journal } from './journal'
import { cleSecours, creerSauvegarde, lireSauvegarde, resumeSauvegarde, tailleMax } from './backup'
import { jourParis } from './motis'

function telecharger(texte: string, nom: string) {
  const url = URL.createObjectURL(new Blob([texte], { type: 'application/json' }))
  const lien = document.createElement('a')
  lien.href = url; lien.download = nom
  document.body.appendChild(lien); lien.click(); lien.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}
export default function Sauvegarde({ journal, bloque, surRestaurer }: { journal: Journal; bloque: boolean; surRestaurer: (j: Journal) => void }) {
  const [importe, setImporte] = useState<Journal | null>(null)
  const [nom, setNom] = useState('')
  const [confirme, setConfirme] = useState(false)
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')
  const [message, setMessage] = useState('')
  const [secoursDisponible] = useState(() => { try { return localStorage.getItem(cleSecours) !== null } catch { return false } })
  const resume = importe ? resumeSauvegarde(importe) : null
  const actuel = resumeSauvegarde(journal)
  return <details className="outils-calendrier"><summary>Sauvegarder et restaurer</summary>
    <p className="note">Fichier personnel : noms, adresses et horaires.</p>
    <button disabled={bloque} onClick={() => {
      try {
        telecharger(creerSauvegarde(journal), `louna-and-co-${jourParis()}.json`)
        setMessage('Téléchargement lancé. Vérifie tes fichiers.'); setErreur('')
      } catch { setErreur('Export impossible. Réessaie depuis ton navigateur.') }
    }}>Exporter ma sauvegarde</button>
    <label className="choix-sauvegarde">Restaurer depuis un fichier
      <input type="file" accept=".json,application/json" disabled={occupe} onChange={async e => {
        const fichier = e.target.files?.[0]
        e.target.value = ''
        if (!fichier) return
        setImporte(null); setConfirme(false); setErreur(''); setMessage(''); setOccupe(true)
        try {
          if (fichier.size > tailleMax) throw new Error('Fichier trop volumineux : maximum 5 Mo.')
          const journalImporte = lireSauvegarde(await fichier.text())
          setImporte(journalImporte); setNom(fichier.name)
        } catch (e) { setErreur(e instanceof Error ? e.message : 'Lecture impossible.') }
        finally { setOccupe(false) }
      }} />
    </label>
    {occupe && <p role="status">Vérification du fichier…</p>}
    {resume && <div className="apercu-sauvegarde">
      <strong>Fichier : {nom}</strong>
      <p>{resume.jours} journée(s) · {resume.interventions} intervention(s) · {resume.pointages} pointage(s)</p>
      {resume.debut && <p>Du {resume.debut.split('-').reverse().join('/')} au {resume.fin.split('-').reverse().join('/')}</p>}
      <p className="avertissement">Remplace les {actuel.jours} journée(s) de cet appareil. Une copie de secours sera conservée.</p>
      <label className="option-pointages"><input type="checkbox" checked={confirme} onChange={e => setConfirme(e.target.checked)} />Je veux remplacer les données actuelles.</label>
      <div className="actions">
        <button disabled={!confirme} onClick={() => {
          try { surRestaurer(importe!); setImporte(null); setConfirme(false) }
          catch (e) { setErreur(e instanceof Error ? e.message : 'Restauration impossible.') }
        }}>Confirmer la restauration</button>
        <button className="bouton-secondaire" onClick={() => { setImporte(null); setConfirme(false); setErreur('') }}>Annuler</button>
      </div>
    </div>}
    {secoursDisponible && <details className="aide-stockage"><summary>Copie avant la dernière restauration</summary>
      <button onClick={() => {
        try {
          const brut = localStorage.getItem(cleSecours)
          if (brut === null) throw new Error('Copie de secours introuvable.')
          telecharger(brut, `louna-and-co-secours-${jourParis()}.json`)
          setMessage('Téléchargement de la copie de secours lancé.'); setErreur('')
        } catch (e) { setErreur(e instanceof Error ? e.message : 'Export de secours impossible.') }
      }}>Exporter la copie de secours</button>
    </details>}
    {message && <p className="note" role="status">{message}</p>}
    {erreur && <p className="avertissement" role="alert">{erreur}</p>}
  </details>
}
