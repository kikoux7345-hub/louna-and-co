import { useEffect, useRef, useState } from 'react'
import { chercherLieux, contact, heureParis, libelleLieu, lienMarche } from './motis'
import type { Lieu } from './motis'
import type { Planning } from './planning'
import { nomIntervention } from './planning'
import { calculerJournee } from './agenda'
import type { PointagesJournee, ResultatJournee, RouteJournee } from './agenda'

const minutes = (ms: number) => `${Math.floor(ms / 60000)} min`
function BlocTrajet({ route }: { route: RouteJournee }) {
  const i = route.itineraire
  return <div className="bloc-trajet-journee">
    <h3>{route.titre}</h3>
    <p className="note">{route.depart} → {route.arrivee}</p>
    {!i ? <p className="avertissement">{route.erreur || 'Trajet non calculé'}</p> : <>
      <p><strong>{heureParis(i.startTime)} → {heureParis(i.endTime)}</strong> · {Math.ceil(i.duration / 60)} min</p>
      {route.libreAvant > 0 && <p>☕ Temps libre avant le départ : {minutes(route.libreAvant)}</p>}
      {route.margeArrivee > 0 && <p>⏳ Marge sur place avant l’intervention : {minutes(route.margeArrivee)}</p>}
      {route.retard > 0 && <p className="avertissement">⚠️ Arrivée prévue avec {Math.ceil(route.retard / 60000)} min de retard.</p>}
      <details><summary>Voir les étapes du trajet</summary>
        <ol className="etapes-motis">{i.legs.map((l, index) => {
          const lien = lienMarche(l)
          return <li key={index}>
            <strong>{l.mode === 'WALK' ? '🚶 Marche' : `🚌 ${l.routeShortName ?? l.displayName ?? l.mode}`}</strong>
            {l.headsign && <span> · direction {l.headsign}</span>}
            <p>{heureParis(l.startTime)} · {l.from.name}<br />{heureParis(l.endTime)} · {l.to.name}</p>
            <small>{Math.ceil(l.duration / 60)} min · {l.realTime ? 'temps réel fourni' : 'horaire théorique'}</small>
            {lien && <p><a href={lien} target="_blank" rel="noopener noreferrer">🚶 Voir le chemin à pied ↗</a></p>}
          </li>
        })}</ol>
      </details>
    </>}
  </div>
}

function VueJournee({ planning, pointages, jour, surIntervention }: { planning: Planning; pointages: PointagesJournee; jour: string; surIntervention: (index: number) => void }) {
  const adresses = [...new Set([planning.domicile, ...planning.interventions.map(i => i.adresse)])]
  const [lieux, setLieux] = useState<Record<string, Lieu[]> | null>(null)
  const [choix, setChoix] = useState<Record<string, number>>({})
  const [avecPointages, setAvecPointages] = useState(true)
  const [resultat, setResultat] = useState<ResultatJournee | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [progression, setProgression] = useState('')
  const [erreur, setErreur] = useState('')
  const requete = useRef<AbortController | null>(null)
  useEffect(() => () => requete.current?.abort(), [])

  async function lancer() {
    const controle = new AbortController()
    requete.current = controle
    setOccupe(true)
    setErreur('')
    setResultat(null)
    try {
      if (!lieux) {
        const trouves: Record<string, Lieu[]> = {}
        for (const [index, adresse] of adresses.entries()) {
          controle.signal.throwIfAborted()
          setProgression(`Recherche de l’adresse ${index + 1} sur ${adresses.length}…`)
          const delai = window.setTimeout(() => controle.abort(), 30000)
          try { trouves[adresse] = await chercherLieux(adresse, controle.signal) }
          finally { window.clearTimeout(delai) }
        }
        controle.signal.throwIfAborted()
        setLieux(trouves)
        setChoix(Object.fromEntries(adresses.map(a => [a, 0])))
      } else {
        const selection = new Map(adresses.map(a => [a, lieux[a][choix[a] ?? 0]]))
        const r = await calculerJournee(planning, jour, selection, pointages, avecPointages, controle.signal, setProgression)
        controle.signal.throwIfAborted()
        setResultat(r)
      }
    } catch (e) {
      if (!controle.signal.aborted) setErreur(e instanceof Error ? e.message : 'Calcul impossible.')
      else setErreur('Recherche arrêtée ou délai de connexion dépassé. Tu peux réessayer.')
    } finally {
      if (requete.current === controle) { setOccupe(false); setProgression('') }
    }
  }
  const incomplet = resultat?.routes.some(r => !r.itineraire) ?? false
  const retard = resultat?.interventions.some(i => i.retard > 0) ?? false
  const dureeInsuffisante = resultat?.interventions.some(i => i.debutReel !== undefined && i.finReelle !== undefined && i.finReelle - i.debutReel < i.intervention.minutes * 60000) ?? false
  const debut = resultat?.routes[0]?.itineraire?.startTime
  const fin = resultat?.routes[resultat.routes.length - 1]?.itineraire?.endTime
  const transport = resultat?.routes.reduce((n, r) => n + (r.itineraire?.duration ?? 0), 0) ?? 0
  const marche = resultat?.routes.reduce((n, r) => n + (r.itineraire?.legs.reduce((s, l) => s + (l.mode === 'WALK' ? l.duration : 0), 0) ?? 0), 0) ?? 0
  const libre = resultat?.routes.reduce((n, r) => n + r.libreAvant + r.margeArrivee, 0) ?? 0
  if (!planning.interventions.length) return <p>Aucune intervention : journée libre, aucun trajet à calculer.</p>
  return <>
    <label className="option-pointages"><input type="checkbox" checked={avecPointages} disabled={occupe} onChange={e => { setAvecPointages(e.target.checked); setResultat(null) }} />Tenir compte des pointages de la date choisie</label>
    {lieux && <details className="lieux-journee" open={!resultat}>
      <summary>Vérifier les adresses trouvées</summary>
      {adresses.map(adresse => <label key={adresse}>{adresse}
        <select value={choix[adresse] ?? 0} disabled={occupe} onChange={e => { setChoix(p => ({...p, [adresse]: Number(e.target.value)})); setResultat(null) }}>
          {lieux[adresse].map((l, index) => <option key={index} value={index}>{libelleLieu(l)}</option>)}
        </select>
      </label>)}
    </details>}
    <div className="actions"><button onClick={lancer} disabled={occupe}>{occupe ? 'Calcul en cours…' : lieux ? '🚌 Calculer toute ma journée' : '📍 Rechercher les adresses'}</button>
      {occupe && <button onClick={() => requete.current?.abort()}>Arrêter</button>}
    </div>
    {occupe && <p role="status">{progression}</p>}
    {erreur && <p role="alert" className="avertissement">{erreur}</p>}
    {resultat && <>
      <div className="resume-journee" role="status">
        <h3>{incomplet ? '⚠️ Prévisualisation incomplète' : dureeInsuffisante ? '⚠️ Durée réelle insuffisante' : retard ? '⚠️ Retard constaté ou à prévoir' : '✓ Journée compatible avec les horaires calculés'}</h3>
        {incomplet && <p>Trajet manquant : la suite reste à confirmer.</p>}
        {debut && <p>🏠 Départ conseillé : <strong>{heureParis(debut)}</strong></p>}
        {fin && <p>🏡 Retour estimé : <strong>{heureParis(fin)}</strong>{incomplet ? ' · sous réserve des trajets manquants' : ''}</p>}
        <p>🚌 Trajets calculés : {Math.ceil(transport / 60)} min, dont {Math.ceil(marche / 60)} min à pied.</p>
        <p>☕ Temps libre et marges {incomplet ? 'sur les trajets calculés' : 'entre les étapes'} : {minutes(libre)}</p>
        <p className="note">Calcul à {heureParis(resultat.calculeA)} · à vérifier avant le départ.</p>
      </div>
      <ol className="chronologie-journee">
        {resultat.interventions.map((p, index) => <li key={p.intervention.id}>
          <BlocTrajet route={resultat.routes[index]} />
          <article className="intervention-journee">
            <h3>{nomIntervention(p.intervention, index)}</h3>
            <p>{p.intervention.adresse}</p>
            <p><strong>Officiel : {p.intervention.debut} – {p.intervention.fin}</strong> · {p.intervention.minutes} min obligatoires</p>
            <p>{p.debutReel !== undefined ? 'Début réel' : 'Début estimé'} : {heureParis(new Date(p.debutPrevu).toISOString())}</p>
            <p>{p.finReelle !== undefined ? 'Fin réelle' : 'Fin estimée'} : {heureParis(new Date(p.finPrevue).toISOString())}</p>
            {p.retard > 0 && <p className="avertissement">⚠️ Début décalé de {Math.ceil(p.retard / 60000)} min · horaire officiel inchangé.</p>}
            {p.debutReel !== undefined && p.finReelle !== undefined && p.finReelle - p.debutReel < p.intervention.minutes * 60000 && <p className="avertissement">⚠️ La durée réellement enregistrée est inférieure à la durée obligatoire.</p>}
            <button onClick={() => surIntervention(index)}>Afficher cette intervention</button>
          </article>
        </li>)}
        <li><BlocTrajet route={resultat.routes[resultat.routes.length - 1]} /></li>
      </ol>
    </>}
    {!resultat && <ol className="apercu-officiel">
      <li>🏠 Départ de la maison : à calculer</li>
      {planning.interventions.map((i, index) => <li key={i.id}>{i.debut} – {i.fin} · {nomIntervention(i, index)}<br /><span className="note">{i.adresse}</span></li>)}
      <li>🏡 Retour à la maison : à calculer</li>
    </ol>}
    <details className="credits-motis"><summary>À propos des trajets</summary>
      <p>Adresses et coordonnées envoyées à Transitous lors des recherches. Aucun recalcul automatique. Les horaires officiels restent fixes ; les estimations tiennent compte des retards et des pointages choisis.</p>
      <p>Louna &amp; Co · calculs MOTIS via <a href="https://transitous.org/" target="_blank" rel="noopener noreferrer">Transitous</a> · Contact : <a href={`mailto:${contact}`}>{contact}</a></p>
      <p><a href="https://transitous.org/sources/" target="_blank" rel="noopener noreferrer">Sources des transports</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">contributeurs OpenStreetMap</a></p>
    </details>
  </>
}

export default function Journee({ planning, pointages, surIntervention, jour }: { planning: Planning; pointages: PointagesJournee; surIntervention: (index: number) => void; jour: string }) {
  return <section aria-label="Prévisualisation de la journée">
    <h2>📅 Toute ma journée</h2>
    <VueJournee key={JSON.stringify([planning, jour, pointages])} planning={planning} pointages={pointages} jour={jour} surIntervention={surIntervention} />
  </section>
}
