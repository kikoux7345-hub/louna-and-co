import { useEffect, useRef, useState } from 'react'
import { validerPlanning, nouvelId, nomIntervention } from './planning'
import type { Intervention, Planning } from './planning'

export default function EditeurPlanning({ planning, surSauvegarde, surAnnuler, pointages }: {
  planning: Planning; surSauvegarde: (p: Planning) => void; surAnnuler: () => void;
  pointages: Record<string, { debut: number | null; fin: number | null }>;
}) {
  const [domicile, setDomicile] = useState(planning.domicile)
  const [interventions, setInterventions] = useState(() => planning.interventions.map(p => ({ ...p })))
  const [supprimees, setSupprimees] = useState<Intervention[]>([])
  const [ouverte, setOuverte] = useState<string | null>(null)
  const [erreur, setErreur] = useState('')
  const titre = useRef<HTMLHeadingElement>(null)
  useEffect(() => { titre.current?.focus() }, [])

  function modifier(id: string, valeurs: Partial<Intervention>) {
    setInterventions(liste => liste.map(p => p.id === id ? { ...p, ...valeurs } : p))
    setErreur('')
  }
  function enregistrer(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const invalide = e.currentTarget.querySelector<HTMLInputElement>('input:invalid')
    if (invalide) {
      const panneau = invalide.closest('details')
      if (panneau) { panneau.open = true; setOuverte(panneau.dataset.panneau ?? null) }
      invalide.focus()
      invalide.reportValidity()
      setErreur('Vérifie le champ indiqué avant d’enregistrer.')
      return
    }
    try {
      surSauvegarde(validerPlanning({ domicile, interventions }))
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Enregistrement impossible.')
    }
  }
  return <main className="planning-compact">
    <h1 ref={titre} tabIndex={-1}>✏️ Mon planning</h1>
    <p className="intro-compacte">Touche une ligne pour la modifier.</p>
    <form noValidate onSubmit={enregistrer} className="editeur-planning">
      <details className="panneau-planning" data-panneau="maison" open={ouverte === 'maison'}>
        <summary onClick={e => { e.preventDefault(); setOuverte(ouverte === 'maison' ? null : 'maison') }}>
          <span className="resume-panneau"><strong>🏠 Maison</strong><span>{domicile || 'Adresse à compléter'}</span></span>
        </summary>
        <div className="contenu-panneau"><label>Adresse de départ et retour
          <input required minLength={5} maxLength={300} value={domicile} autoComplete="street-address" onChange={e => setDomicile(e.target.value)} placeholder="Numéro, rue et ville" />
        </label></div>
      </details>
      <h2 className="titre-interventions">Interventions · {interventions.length}</h2>
      {interventions.map((p, index) => <details className="panneau-planning" key={p.id} data-panneau={p.id} open={ouverte === p.id}>
        <summary onClick={e => { e.preventDefault(); setOuverte(ouverte === p.id ? null : p.id) }}>
          <span className="resume-panneau"><strong>{nomIntervention(p, index)} <small>{p.debut || '—'} – {p.fin || '—'}</small></strong><span>{p.adresse || 'Adresse à compléter'}</span></span>
        </summary>
        <div className="contenu-panneau">
          <label>Nom du client
            <input maxLength={80} value={p.client ?? ''} onChange={e => modifier(p.id, { client: e.target.value })} placeholder="Ex. Mme Martin" autoComplete="off" />
          </label>
          {pointages[p.id]?.debut != null && <p className="badge-pointages">✓ Pointages conservés</p>}
          <label>Adresse
            <input required minLength={5} maxLength={300} value={p.adresse} onChange={e => modifier(p.id, { adresse: e.target.value })} placeholder="Numéro, rue et ville" />
          </label>
          <div className="horaires-editeur">
            <label>Début officiel<input required type="time" value={p.debut} onChange={e => modifier(p.id, { debut: e.target.value })} /></label>
            <label>Fin officielle<input required type="time" value={p.fin} onChange={e => modifier(p.id, { fin: e.target.value })} /></label>
          </div>
          <label>Durée obligatoire · min
            <input required type="number" inputMode="numeric" min={1} max={1440} step={1} value={Number.isNaN(p.minutes) ? '' : p.minutes} onChange={e => modifier(p.id, { minutes: e.target.valueAsNumber })} />
          </label>
          <button className="bouton-secondaire retirer-compact" type="button" onClick={() => {
            setInterventions(liste => liste.filter(x => x.id !== p.id))
            setSupprimees(liste => [...liste, p]); setOuverte(null); setErreur('')
          }} aria-label={`Retirer l’intervention ${index + 1}`}>Retirer</button>
        </div>
      </details>)}
      {interventions.length === 0 && <p>Aucune intervention. Ajoute-en une ou enregistre une journée vide.</p>}
      {supprimees.length > 0 && <button className="bouton-secondaire" type="button" onClick={() => {
        const derniere = supprimees[supprimees.length - 1]
        setInterventions(liste => [...liste, { ...derniere }]); setSupprimees(liste => liste.slice(0, -1))
        setOuverte(derniere.id); setErreur('')
      }}>↶ Annuler le dernier retrait</button>}
      <button className="ajouter-compact" type="button" disabled={interventions.length + supprimees.length >= 50} onClick={() => {
        const id = nouvelId()
        setInterventions(liste => [...liste, { id, adresse: '', debut: '', fin: '', minutes: 60 }])
        setOuverte(id)
      }}>＋ Ajouter une intervention</button>
      <details className="aide-compacte"><summary>Bon à savoir</summary>
        <p>Adresses à Tours et ses environs proches. Les horaires officiels changent seulement à l’enregistrement. Les interventions sont classées par heure de début et leurs pointages sont conservés. Recalcule les trajets après modification.</p>
      </details>
      {erreur && <p role="alert" className="avertissement">{erreur}</p>}
      <div className="actions actions-editeur">
        <button type="submit">💾 Enregistrer</button>
        <button className="bouton-secondaire" type="button" onClick={surAnnuler}>Annuler</button>
      </div>
    </form>
  </main>
}
