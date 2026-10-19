import { useState } from 'react'
import { autreJour } from './journal'
import type { Journal } from './journal'
import { heureParis, jourParis } from './motis'
import { nomIntervention } from './planning'
import Sauvegarde from './Sauvegarde'

function dateFr(jour: string) { return new Date(`${jour}T12:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) }
function duree(ms: number) { const s = Math.floor(ms / 1000), m = Math.floor(s / 60); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min ${String(s % 60).padStart(2, '0')} s` }
export default function Calendrier({ journal, jour, surJour, surCopier, bloque, surRestaurer }: { journal: Journal; jour: string; surJour: (j: string) => void; surCopier: (destination: string) => void; bloque: boolean; surRestaurer: (j: Journal) => void }) {
  const [destination, setDestination] = useState(() => autreJour(jour, 1))
  const [erreur, setErreur] = useState('')
  const dates = Object.keys(journal.jours).sort().reverse()
  return <section className="calendrier-planning" aria-label="Calendrier du planning">
    <label className="date-motis">Journée sélectionnée<input type="date" required value={jour} onChange={e => { if (e.target.value) surJour(e.target.value) }} /></label>
    <div className="navigation-dates">
      <button aria-label="Jour précédent" onClick={() => surJour(autreJour(jour, -1))}>‹ Veille</button>
      <button onClick={() => surJour(jourParis())}>Aujourd’hui</button>
      <button aria-label="Jour suivant" onClick={() => surJour(autreJour(jour, 1))}>Lendemain ›</button>
    </div>
    <details className="outils-discrets"><summary>Options et historique</summary>
    <Sauvegarde journal={journal} bloque={bloque} surRestaurer={surRestaurer} />
    <details className="outils-calendrier"><summary>Copier ce planning</summary>
      <p className="note">Vers une date vide · sans les pointages.</p>
      <label className="date-motis">Date de destination<input type="date" required value={destination} onChange={e => setDestination(e.target.value)} /></label>
      <button onClick={() => { try { surCopier(destination); setErreur('') } catch (e) { setErreur(e instanceof Error ? e.message : 'Copie impossible.') } }}>Copier vers cette date</button>
      {erreur && <p className="avertissement" role="alert">{erreur}</p>}
    </details>
    <details className="outils-calendrier"><summary>Historique · {dates.length} journée(s)</summary>
      {dates.map(date => {
        const entree = journal.jours[date]
        const termines = Object.values(entree.pointages).filter(p => p.debut !== null && p.fin !== null)
        const total = termines.reduce((n, p) => n + p.fin! - p.debut!, 0)
        return <details key={date} className="jour-historique"><summary>{dateFr(date)} · {entree.planning.interventions.length} inter.</summary>
          {entree.importe && <p className="note">Journée importée : les pointages sont ceux enregistrés à cette date. L’ancien planning n’était pas historisé ; le planning associé est celui récupéré lors de la mise à jour.</p>}
          <p>{termines.length} terminée(s) · durée réelle cumulée : {duree(total)}</p>
          {Object.entries(entree.pointages).map(([id, p]) => {
            const i = entree.planning.interventions.find(x => x.id === id)
            return <div className="pointage-historique" key={id}>
              <strong>{i ? nomIntervention(i, entree.planning.interventions.findIndex(p => p.id === id)) : 'Intervention retirée du planning'}</strong>
              {i && <p>{i.adresse}</p>}
              {i && <p>Officiel : {i.debut} – {i.fin} · {i.minutes} min obligatoires</p>}
              <p>Début : {p.debut === null ? 'Non commencée' : heureParis(new Date(p.debut).toISOString())}<br />Fin : {p.fin === null ? 'Non terminée' : heureParis(new Date(p.fin).toISOString())}</p>
              {p.debut !== null && p.fin !== null && <p>Durée réelle : {duree(p.fin - p.debut)}{i && p.fin - p.debut < i.minutes * 60000 ? ' ⚠️ Durée insuffisante' : ''}</p>}
            </div>
          })}
          <button onClick={() => surJour(date)}>Ouvrir cette journée</button>
        </details>
      })}
    </details>
    </details>
  </section>
}
