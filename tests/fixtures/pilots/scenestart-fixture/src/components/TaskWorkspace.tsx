import { useReducer, useState } from "react";

import { generatedPlan } from "../generated/plan";
import { sourceBoundaries } from "../domain/source-mode";
import { initialTaskState, taskReducer } from "../domain/task-state";
import { SourceBoundaryPanel } from "./SourceBoundaryPanel";
import { downloadText, exportProduction, loadProduction, parseProduction, projectKey } from "../domain/production";
import { ProductionPreview } from "./ProductionPreview";

export function TaskWorkspace() {
  const [state, dispatch] = useReducer(taskReducer, initialTaskState);
  const source = sourceBoundaries[state.mode];

  const [initial] = useState(loadProduction);
  const [handle, setHandle] = useState(initial.handle);
  const [concept, setConcept] = useState(initial.concept);
  const [title, setTitle] = useState(initial.title);
  const [scenes, setScenes] = useState(initial.scenes);
  const [restart, setRestart] = useState(0);
  const project = { version: 2 as const, handle, concept, title, scenes: scenes.map((scene, index) => index === 0 ? { ...scene, title } : scene) };
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [saved, setSaved] = useState(false);

  function runTask() {
    dispatch({ type: "start" });
    if (source.canRunTask) queueMicrotask(() => dispatch({ type: "complete" }));
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 65536) throw new Error('Oversized project');
      const imported = parseProduction(await file.text());
      setHandle(imported.handle); setConcept(imported.concept); setTitle(imported.title); setScenes(imported.scenes);
      setErrorMsg(''); setSaved(false); setIsPlaying(false); setRestart(value => value + 1);
    } catch {
      setErrorMsg("Invalid project");
      dispatch({ type: "start" });
      queueMicrotask(() => dispatch({ type: "fail", message: "Invalid project" }));
    }
  };

  return (
    <div className="scenestart-shell" data-ztothez-product="scenestart">
      <header className="product-nav" data-ztothez-fidelity="product-navigation">
        <a className="scene-brand" href="/learn">SCENESTART</a>
        <nav aria-label="SceneStart navigation"><a href="/studio" aria-current="page">Studio</a><a href="/learn">Learn</a><a href="/workshop">Workshop</a><a href="/learn/release">Release</a></nav>
      </header>
    <main className="workspace" data-ztothez-design-composition="1.0" data-ztothez-design-max-primary-actions="1" data-ztothez-design-max-visible-regions="4">
      <header className="product-header" data-ztothez-design-priority="context" data-ztothez-fidelity="product-identity">
        <div data-ztothez-fidelity="studio-context">
          <p className="eyebrow">Operational decision workspace</p>
          <h1>Demo Studio</h1>
          <p className="lede">{generatedPlan.task.label}</p>
        </div>
        <span className="route-label">Route {generatedPlan.task.route}</span>
      </header>

      <section className="decision-layout" aria-labelledby="decision-heading">
        <div className="primary-flow" data-ztothez-design-region="primary-decision">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Primary task</p>
              <h2 id="decision-heading">Review and record the bounded decision</h2>
            </div>
            <span className={`status status--${state.phase}`} data-ztothez-design-status data-ztothez-design-status-purpose="task-phase" data-ztothez-design-state-visual data-ztothez-design-non-color-cue="visible-text">{state.phase}</span>
          </div>

          <div className="finding studio-editor" data-ztothez-design-priority="primary-outcome" data-ztothez-design-visual-claim="selected-record" data-ztothez-design-claim-basis="synthetic" data-ztothez-design-evidence-ref="local-fixture-priority-record-01">
            <div className="project-fields" data-ztothez-fidelity="project-metadata">
              <label><span>HANDLE</span><input maxLength={8} value={handle} aria-label="Handle" onChange={e => { setHandle(e.target.value); setSaved(false); }} /></label>
              <label><span>CONCEPT</span><input maxLength={500} value={concept} aria-label="Concept" onChange={e => { setConcept(e.target.value); setSaved(false); }} /></label>
              <label><span>TITLE</span><input maxLength={120} value={title} aria-label="Title" onChange={e => { setTitle(e.target.value); setSaved(false); }} /></label>
              <label className="project-upload"><span>PROJECT FILE</span><input type="file" aria-label="Upload project" onChange={handleFileUpload} /></label>
            </div>
            <div data-ztothez-fidelity="production-preview"><ProductionPreview project={project} playing={isPlaying} restart={restart} /></div>
            <p>Editable starter visuals; not an originality or release certification.</p>

            <div className="production-actions" data-ztothez-fidelity="production-actions">
            {isPlaying ? (
              <button onClick={() => setIsPlaying(false)}>PAUSE</button>
            ) : (
              <button onClick={() => setIsPlaying(true)}>PLAY PRODUCTION</button>
            )}
            <button onClick={() => { setRestart(value => value + 1); setIsPlaying(true); }}>RESTART</button>

            <button onClick={() => {
              const content = JSON.stringify(parseProduction(JSON.stringify(project)), null, 2);
              downloadText("scenestart-production.json", content, "application/json");
              try { localStorage.setItem(projectKey, content); setErrorMsg(''); } catch { setErrorMsg('Storage unavailable. Keep the downloaded project.'); }
              setSaved(true);
            }}>SAVE PROJECT</button>

            <button onClick={() => {
              downloadText("my-production.html", exportProduction(project), "text/html");
            }}>EXPORT OFFLINE HTML</button>
            </div>

            {saved && <div role="status">Project saved locally.</div>}
            {errorMsg && <div role="alert">{errorMsg}</div>}
          </div>

          <div className="action-row" data-ztothez-design-priority="next-action">
            <p className="action-boundary"><strong>{source.label}</strong> · {source.origin}</p>
            <button className="primary-action" type="button" data-ztothez-design-primary-action onClick={runTask} disabled={!source.canRunTask || state.phase === "running" || state.phase === "success"}>
              {state.phase === "running" ? "Recording decision" : state.phase === "success" ? "Decision recorded" : "Record decision"}
            </button>
            <button type="button" onClick={() => dispatch({ type: "return-to-review" })}>Return to review</button>
          </div>
          <ol className="answer-flow">
            {generatedPlan.informationFlow.map((entry) => (
              <li key={entry.id}><span>{entry.order}</span><div><strong>{entry.label}</strong><p>{entry.purpose}</p></div></li>
            ))}
          </ol>
        </div>

        <aside className="recovery" aria-labelledby="recovery-heading" data-ztothez-design-region="recovery" data-ztothez-fidelity="recovery">
          <p className="eyebrow">Recovery path</p>
          <h2 id="recovery-heading">Preserve context when a source is unavailable</h2>
          <p aria-live="polite" className="task-message">{state.message}</p>
          {!source.canRunTask && (
            <div className="recovery-actions">
              <button type="button" onClick={() => dispatch({ type: "retry-source" })}>Retry source</button>
              <button type="button" onClick={() => dispatch({ type: "use-demo-fallback" })}>Use disclosed demo fallback</button>
            </div>
          )}
          <p className="evidence-boundary">This fixture validates generated structure and state behavior. It does not prove live connectivity, rendered accessibility, product usability, or release readiness.</p>
        </aside>
      </section>

      <section id="data-boundary" data-ztothez-fidelity="data-boundary"><SourceBoundaryPanel mode={state.mode} onChange={(mode) => dispatch({ type: "select-mode", mode })} /></section>
    </main>
    </div>
  );
}
