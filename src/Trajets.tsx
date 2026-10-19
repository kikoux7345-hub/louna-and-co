import { useEffect, useRef, useState } from 'react'
import { calculer, chercherLieux, contact, dureeMarche, heureParis, instantParis, libelleLieu, lienMarche } from './motis'
import type { Itineraire, Lieu } from './motis'
import { nomIntervention } from './planning'

type Intervention = { readonly id: string; readonly client?: string; readonly adresse: string; readonly debut: string; readonly fin: string }
type Pointages = Record<string, { debut: number | null; fin: number | null }>
type Trajet = { id: string; titre: string; depart: string; arrivee: string; heure: string; arriveBy: boolean; limite?: string; reel?: number }

function CarteTrajet({ trajet, jour }: { trajet: Trajet; jour: string }) {
  const [lieux, setLieux] = useState<[Lieu[], Lieu[]] | null>(null)
  const [depart, setDepart] = useState(0)
  const [arrivee, setArrivee] = useState(0)
  const [resultats, setResultats] = useState<Itineraire[] | null>(null)
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)
  const controle = useRef<AbortController | null>(null)
  useEffect(() => () => controle.current?.abort(), [])

  async function rechercher() {
    controle.current?.abort()
    const requete = new AbortController()
    controle.current = requete
    const timeout = window.setTimeout(() => requete.abort(), 30000)
    setOccupe(true)
    setErreur('')
    setResultats(null)
    try {
      if (!lieux) {
        // Recherches séquentielles, uniquement sur demande.
        const de = await chercherLieux(trajet.depart, requete.signal)
        const vers = await chercherLieux(trajet.arrivee, requete.signal)
        setLieux([de, vers])
        setDepart(0)
        setArrivee(0)
      } else {
        const instant = trajet.reel === undefined ? instantParis(jour, trajet.heure) : new Date(trajet.reel).toISOString()
        const trouves = await calculer(lieux[0][depart], lieux[1][arrivee], instant, trajet.arriveBy, requete.signal, limite)
        setResultats(trouves)
      }
    } catch (e) {
      if (!requete.signal.aborted) setErreur(e instanceof Error ? e.message : 'Connexion au service impossible.')
      else setErreur('La recherche a pris trop de temps. Réessaie lorsque la connexion est disponible.')
    } finally {
      window.clearTimeout(timeout)
      if (controle.current === requete) setOccupe(false)
    }
  }
  const modes: Record<string, string> = { WALK: '🚶 Marche', BUS: '🚌 Bus', TRAM: '🚊 Tram', SUBWAY: '🚇 Métro', RAIL: '🚆 Train', REGIONAL_RAIL: '🚆 Train régional', SUBURBAN: '🚆 Train' }
  const limite = trajet.limite ? Date.parse(instantParis(jour, trajet.limite)) : undefined

  return (
    <article className="carte-trajet">
      <h3>{trajet.titre}</h3>
      <p>De : {trajet.depart}</p><p>À : {trajet.arrivee}</p>
      <p><strong>{trajet.arriveBy ? 'Arriver au plus tard à' : 'Partir à partir de'} {trajet.reel === undefined ? trajet.heure : heureParis(new Date(trajet.reel).toISOString())}</strong>{trajet.reel !== undefined ? ' · fin réelle enregistrée' : ' · horaire officiel'}</p>
      {lieux && <details className="adresses-motis" open={!resultats}><summary>Vérifier les adresses</summary>
        <label>Départ
          <select value={depart} disabled={occupe} onChange={e => { setDepart(Number(e.target.value)); setResultats(null) }}>
            {lieux[0].map((l, i) => <option value={i} key={i}>{libelleLieu(l)}</option>)}
          </select>
        </label>
        <label>Arrivée
          <select value={arrivee} disabled={occupe} onChange={e => { setArrivee(Number(e.target.value)); setResultats(null) }}>
            {lieux[1].map((l, i) => <option value={i} key={i}>{libelleLieu(l)}</option>)}
          </select>
        </label>
      </details>}
      <button disabled={occupe} onClick={rechercher}>{occupe ? 'Recherche en cours…' : lieux ? 'Calculer avec MOTIS' : 'Rechercher les adresses'}</button>
      {occupe && <p role="status">Connexion à MOTIS…</p>}
      {erreur && <p className="avertissement" role="alert">{erreur}</p>}
      {resultats?.length === 0 && <p className="avertissement" role="status">Aucun trajet trouvé. Les données peuvent être incomplètes.</p>}
      {resultats?.map((itineraire, index) => {
        const retard = limite === undefined ? 0 : Math.max(0, Date.parse(itineraire.endTime) - limite)
        const transport = itineraire.legs.some(l => l.mode !== 'WALK')
        return <details className="resultat-motis" key={index} open={index === 0}>
          <summary>{transport ? '🚌' : '🚶'} {heureParis(itineraire.startTime)} → {heureParis(itineraire.endTime)} · {Math.ceil(itineraire.duration / 60)} min · 🚶 {Math.ceil(dureeMarche(itineraire) / 60)} min</summary>
          {retard > 0 ? <p className="avertissement">⚠️ Retard prévu : {Math.ceil(retard / 60000)} min.</p>
            : limite !== undefined && <p className="succes">✓ À l’heure · marge de {Math.floor((limite - Date.parse(itineraire.endTime)) / 60000)} min.</p>}
          <p>{transport ? `${itineraire.transfers} correspondance(s)` : 'Trajet entièrement à pied'}</p>
          <ol className="etapes-motis">{itineraire.legs.map((l, i) => {
            const lien = lienMarche(l)
            return <li key={i}>
            <strong>{modes[l.mode] ?? l.mode} {l.routeShortName ?? l.displayName ?? ''}</strong>
            {l.headsign && <span> · direction {l.headsign}</span>}
            <p>{heureParis(l.startTime)} · {l.from.name}<br />{heureParis(l.endTime)} · {l.to.name}</p>
            <small>{Math.ceil(l.duration / 60)} min · {l.realTime ? 'temps réel fourni' : 'horaire théorique'}</small>
            {lien && <p><a
              href={lien} target="_blank" rel="noopener noreferrer"
              aria-label={`Voir le chemin à pied de ${l.from.name} à ${l.to.name} dans Google Maps (nouvel onglet)`}
              className="lien-marche"
            >🚶 Voir le chemin à pied ↗</a></p>}
            {l.mode === 'WALK' && !lien && <p className="note">Carte indisponible : les coordonnées de cette étape ne sont pas fournies.</p>}
          </li>})}</ol>
        </details>
      })}
    </article>
  )
}

export default function Trajets({ interventions, domicile, selection, pointages = {}, jour }: { interventions: readonly Intervention[]; domicile: string; selection?: number; pointages?: Pointages; jour: string }) {
  if (!interventions.length) return null
  const finReelle = (id: string) => {
    const fin = pointages[id]?.fin
    return fin ?? undefined
  }
  const trajets: Trajet[] = [
    { id: 'aller', titre: `Maison → ${nomIntervention(interventions[0], 0)}`, depart: domicile, arrivee: interventions[0].adresse, heure: interventions[0].debut, arriveBy: true, limite: interventions[0].debut },
    ...interventions.slice(0, -1).map((de, i) => ({ id: de.id, titre: `${nomIntervention(de, i)} → ${nomIntervention(interventions[i + 1], i + 1)}`, depart: de.adresse, arrivee: interventions[i + 1].adresse, heure: de.fin, arriveBy: false, limite: interventions[i + 1].debut, reel: finReelle(de.id) })),
    { id: 'retour', titre: `${nomIntervention(interventions[interventions.length - 1], interventions.length - 1)} → Maison`, depart: interventions[interventions.length - 1].adresse, arrivee: domicile, heure: interventions[interventions.length - 1].fin, arriveBy: false, reel: finReelle(interventions[interventions.length - 1].id) },
  ]
  return <section>
    <p className="note">🚶 Moins de marche · jusqu’à 2 min de plus.</p>
    <h2>{selection === undefined ? '🚌 Mes trajets avec MOTIS' : '🚌 Trajet vers cette intervention'}</h2>
    {trajets.filter((_, i) => selection === undefined || i === selection || (selection === interventions.length - 1 && i === interventions.length)).map(t =>
      <CarteTrajet key={JSON.stringify([t.id, jour, t.depart, t.arrivee, t.heure, t.limite, t.reel])} trajet={t} jour={jour} />
    )}
    <details className="credits-motis"><summary>À propos des trajets</summary>
      <p>Recherches à la demande, pour la journée sélectionnée et en heure de Tours. Les adresses sont envoyées à Transitous.</p>
      <p>Prévisions à vérifier avant le départ. Le temps réel dépend du réseau. Google Maps peut proposer un chemin à pied différent.</p>
      <p>Louna &amp; Co · calculs MOTIS via <a href="https://transitous.org/" target="_blank" rel="noopener noreferrer">Transitous</a>.</p>
      <p>Contact : <a href={`mailto:${contact}`}>{contact}</a></p>
      <p>Adresses : <a href="https://adresse.data.gouv.fr/" target="_blank" rel="noopener noreferrer">Base Adresse Nationale</a> via IGN.</p>
      <p><a href="https://transitous.org/sources/" target="_blank" rel="noopener noreferrer">Sources des données de transport</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">contributeurs OpenStreetMap</a></p>
    </details>
  </section>
}
