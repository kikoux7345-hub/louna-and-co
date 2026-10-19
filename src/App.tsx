import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import "./App.css";
import Trajets from "./Trajets";
import Journee from "./Journee";
import CorrectionHeures from "./CorrectionHeures";
import EditeurPlanning from "./EditeurPlanning";
import type { Planning } from "./planning";
import { nomIntervention } from './planning';
import Calendrier from './Calendrier';
import { chargerJournal, copierJour, enregistrerJournal, lireJour, remplacerJour } from './journal';
import type { EntreeJour } from './journal';
import { jourParis } from './motis';
import { restaurerSauvegarde } from './backup';

type Pointage = { debut: number | null; fin: number | null };
type Pointages = Record<string, Pointage>;
const vide = (): Pointage => ({ debut: null, fin: null });


function horodatage(valeur: number | null) {
  return valeur === null
    ? "—"
    : new Date(valeur).toLocaleString("fr-FR", {
        dateStyle: "short",
        timeStyle: "medium",
      });
}
function duree(ms: number) {
  const secondes = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(secondes / 3600)} h ${String(Math.floor(secondes / 60) % 60).padStart(2, "0")} min ${String(secondes % 60).padStart(2, "0")} s`;
}

function ApplicationJour({ jour, entree, surModifier, barre }: { jour: string; entree: EntreeJour; surModifier: (e: EntreeJour) => void; barre: ReactNode }) {
  const [planningCharge] = useState(() => ({ planning: entree.planning, erreur: '' }));
  const [planning, setPlanning] = useState<Planning>(planningCharge.planning);
  const interventions = planning.interventions;
  const [editer, setEditer] = useState(false);
  const [messagePlanning, setMessagePlanning] = useState(planningCharge.erreur);
  const [initial] = useState(() => ({ pointages: entree.pointages, erreur: '' }));
  const [pointages, setPointages] = useState<Pointages>(initial.pointages);
  const [erreur, setErreur] = useState(initial.erreur);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [selection, setSelection] = useState(() => {
    const enCours = interventions.findIndex(({ id }) => {
      const p = initial.pointages[id];
      return p?.debut != null && p.fin === null;
    });
    if (enCours >= 0) return enCours;
    const suivante = interventions.findIndex(({ id }) => initial.pointages[id]?.fin == null);
    return suivante < 0 ? 0 : suivante;
  });
  const [journee, setJournee] = useState(false);
  const [correctionId, setCorrectionId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setMaintenant(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function pointer(id: string, action: "debut" | "fin") {
    const p = pointages[id] ?? vide();
    if (
      action === "debut" ? p.debut !== null : p.debut === null || p.fin !== null
    )
      return;
    // Appel uniquement depuis les boutons : l’horodatage doit être celui du clic.
    // eslint-disable-next-line react-hooks/purity
    const instant = Date.now();
    if (action === 'debut' && jour !== jourParis(new Date(instant))) {
      setErreur('Pour une autre date, utilise « Corriger les heures réelles ». Les boutons enregistrent uniquement l’heure actuelle.');
      return;
    }
    if (action === "fin" && p.debut !== null && instant < p.debut) {
      setErreur(
        "L’horloge de l’appareil a reculé. Corrige-la avant de terminer.",
      );
      return;
    }
    const suivants = { ...pointages, [id]: { ...p, [action]: instant } };
    try {
      surModifier({ planning, pointages: suivants });
      setPointages(suivants);
      setMaintenant(instant);
      setErreur("");
    } catch {
      setErreur(
        "Sauvegarde impossible : le pointage n’a pas été appliqué. Garde la page ouverte et réessaie.",
      );
    }
  }

  const aCorriger = interventions.find(p => p.id === correctionId);
  if (aCorriger) return <CorrectionHeures adresse={aCorriger.adresse}
    client={aCorriger.client}
    numero={interventions.findIndex(p => p.id === aCorriger.id) + 1}
    pointage={pointages[aCorriger.id] ?? vide()} minutes={aCorriger.minutes}
    surAnnuler={() => setCorrectionId(null)}
    surEnregistrer={p => {
      if (p.debut !== null && jourParis(new Date(p.debut)) !== jour) throw new Error('Le début réel doit correspondre à la journée sélectionnée. Change de journée pour saisir une autre date.');
      const suivants = { ...pointages, [aCorriger.id]: p };
      try { surModifier({ planning, pointages: suivants }); }
      catch (cause) { throw new Error('Sauvegarde impossible. La correction n’a pas été appliquée. Garde cet écran ouvert et réessaie.', { cause }); }
      setPointages(suivants);
      setMaintenant(Date.now());
      setErreur('');
      setMessagePlanning('✓ Heures enregistrées · trajets à recalculer.');
      setCorrectionId(null);
    }} />;

  if (editer) return <EditeurPlanning planning={planning} pointages={pointages}
    surAnnuler={() => setEditer(false)}
    surSauvegarde={(suivant) => {
      surModifier({ planning: suivant, pointages });
      const idSelectionne = interventions[selection]?.id;
      const index = suivant.interventions.findIndex(p => p.id === idSelectionne);
      setPlanning(suivant);
      setSelection(index >= 0 ? index : 0);
      setMessagePlanning('✓ Planning enregistré · trajets à recalculer.');
      setEditer(false);
    }} />;

  return (
    <main>
      <header className="app-entete">
        <div><span className="eyebrow">MON QUOTIDIEN</span>
        <h1>Louna &amp; Co</h1>
        <p>Ta journée, simplement.</p></div>
        <img className="icone-marque" src="/louna-co.svg" alt="" width="46" height="46" />
      </header>
      <h2>Mon planning</h2>
      {barre}
      <p className="compteur-planning">{interventions.length} intervention(s) pour cette journée</p>
      {messagePlanning && <p role="status" className="note">{messagePlanning}</p>}
      <div className="vue-commandes">
        <button onClick={() => setEditer(true)}>Modifier le planning</button>
        <button aria-pressed={journee} onClick={() => setJournee(!journee)}>
          {journee ? 'Vue intervention' : 'Toute ma journée'}
        </button>
      </div>
      {!journee && interventions.length > 0 && (
        <nav className="navigation-interventions" aria-label="Choisir une intervention">
          <button aria-label="Intervention précédente" disabled={selection === 0} onClick={() => setSelection(selection - 1)}>‹ Précédente</button>
          <strong role="status">Intervention {selection + 1} sur {interventions.length}</strong>
          <button aria-label="Intervention suivante" disabled={selection === interventions.length - 1} onClick={() => setSelection(selection + 1)}>Suivante ›</button>
        </nav>
      )}
      {erreur && (
        <p className="avertissement" role="alert">
          {erreur}
        </p>
      )}
      {journee && <Journee jour={jour} planning={planning} pointages={pointages} surIntervention={(index) => { setSelection(index); setJournee(false); }} />}
      {!journee && <div className="planning">
        {interventions.length === 0 && <p>Aucune intervention prévue. Utilise « Modifier le planning » pour en ajouter une.</p>}
        {interventions.map((intervention, index) => {
          if (!journee && index !== selection) return null;
          const p = pointages[intervention.id] ?? vide();
          const ecoule =
            p.debut === null
              ? null
              : Math.max(0, (p.fin ?? maintenant) - p.debut);
          const tropCourt =
            p.fin !== null &&
            ecoule !== null &&
            ecoule < intervention.minutes * 60000;
          return (
            <article key={intervention.id} aria-labelledby={intervention.id}>
              <h3 id={intervention.id}>{nomIntervention(intervention, index)}</h3>
              <p>📍 {intervention.adresse}</p>
              <p>
                <strong>
                  Horaire officiel Destia : {intervention.debut} –{" "}
                  {intervention.fin}
                </strong>
              </p>
              <p>Durée obligatoire : {intervention.minutes} minutes</p>
              <hr />
              <p>
                Début réel :{" "}
                {p.debut === null ? "Non commencée" : horodatage(p.debut)}
              </p>
              <p>
                Fin réelle :{" "}
                {p.fin === null ? "Non terminée" : horodatage(p.fin)}
              </p>
              <p>
                Durée réelle
                {p.debut !== null && p.fin === null ? " (en cours)" : ""} :{" "}
                {ecoule === null ? "—" : duree(ecoule)}
              </p>
              <div className="actions">
                <button
                  onClick={() => pointer(intervention.id, "debut")}
                  disabled={p.debut !== null || jour !== jourParis(new Date(maintenant))}
                  aria-label={`Commencer l’intervention ${index + 1}`}
                >
                  Commencer
                </button>
                <button
                  onClick={() => pointer(intervention.id, "fin")}
                  disabled={p.debut === null || p.fin !== null}
                  aria-label={`Terminer l’intervention ${index + 1}`}
                >
                  Terminer
                </button>
              </div>
              <p><button className="corriger-heures" onClick={() => setCorrectionId(intervention.id)} aria-label={`Corriger les heures réelles de l’intervention ${index + 1}`}>Corriger mes heures</button></p>
              {tropCourt && (
                <p className="avertissement" role="alert">
                  ⚠️ Durée insuffisante : {duree(ecoule!)} sur {intervention.minutes} min obligatoires.
                </p>
              )}
              {p.fin !== null && !tropCourt && (
                <p className="succes">
                  ✓ Terminée · durée respectée.
                </p>
              )}
              {journee && <button onClick={() => { setSelection(index); setJournee(false); }}>Afficher cette intervention</button>}
            </article>
          );
        })}
      </div>}
      <details className="aide-stockage"><summary>Enregistrement sur cet appareil</summary><p className="note">
        Les pointages sont conservés dans ce navigateur sur cet appareil, même
        après rechargement. Effacer les données du navigateur les supprime.
      </p></details>
      {!journee && <Trajets jour={jour} interventions={interventions} domicile={planning.domicile} selection={selection} pointages={pointages} />}
    </main>
  );
}

export default function App() {
  const [charge] = useState(chargerJournal);
  const [journal, setJournal] = useState(charge.journal);
  const [jour, setJour] = useState(jourParis);
  const [message, setMessage] = useState(charge.erreur);
  const [bloque, setBloque] = useState(charge.bloque);
  const [revision, setRevision] = useState(0);
  function sauvegarder(suivant: typeof journal) {
    if (bloque) throw new Error(charge.erreur);
    const enregistre = enregistrerJournal(suivant);
    setJournal(enregistre);
    setMessage('');
  }
  return <><ApplicationJour key={`${jour}-${revision}`} jour={jour} entree={lireJour(journal, jour)}
    surModifier={entree => sauvegarder(remplacerJour(journal, jour, entree))}
    barre={<>
      <Calendrier journal={journal} jour={jour} surJour={setJour} bloque={bloque} surRestaurer={importe => {
        const restaure = restaurerSauvegarde(importe, journal);
        setJournal(restaure); setBloque(false); setRevision(n => n + 1);
        const dates = Object.keys(restaure.jours).sort().reverse();
        setJour(restaure.jours[jourParis()] ? jourParis() : dates[0] ?? jourParis());
        setMessage('✓ Sauvegarde restaurée.');
      }} surCopier={destination => {
        sauvegarder(copierJour(journal, jour, destination));
        setJour(destination);
          setMessage('✓ Planning copié · pointages vierges.');
      }} />
      {message && (bloque ? <p className="avertissement" role="alert">{message}</p> : message.startsWith('✓') ? <p className="note" role="status">{message}</p> : <details className="aide-stockage"><summary>Données récupérées</summary><p>{message}</p></details>)}
      {jour !== jourParis() && <p className="note">Pointage en direct disponible le jour même.</p>}
    </>}
  /><footer className="signature-marque"><span>© 2026 Louna &amp; Co</span><a href="/LICENSE.txt" target="_blank" rel="noopener noreferrer">Code sous licence MIT</a></footer></>;
}
