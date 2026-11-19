import * as React from "react";
import { useReducer } from "react";

import { generatedPlan } from "../generated/plan";
import { sourceBoundaries } from "../domain/source-mode";
import { initialTaskState, taskReducer } from "../domain/task-state";
import { SourceBoundaryPanel } from "./SourceBoundaryPanel";
import { createSyntheticSigma } from "../domain/sigma-export";
import type { DataMode } from "../domain/source-mode";

export function TaskWorkspace() {
  const [state, dispatch] = useReducer(taskReducer, initialTaskState);
  const source = sourceBoundaries[state.mode];
  const [demoMode, setDemoMode] = React.useState(false);
  const [technique, setTechnique] = React.useState("");
  const [completedTechnique, setCompletedTechnique] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const requestRef = React.useRef<AbortController | null>(null);
  const [configuration, setConfiguration] = React.useState("Recovery test selected: requests deliberately fail while Demo mode is off.");

  React.useEffect(() => () => requestRef.current?.abort(), []);

  function selectSource(mode: DataMode) {
    requestRef.current?.abort(); requestRef.current = null;
    setCompletedTechnique("");
    dispatch({ type: "select-mode", mode });
  }

  function configureDemo(enabled: boolean, single = false) {
    setDemoMode(enabled);
    setCompletedTechnique("");
    if (single && !technique.trim()) setTechnique("T1059.001");
    dispatch({ type: "return-to-review" });
    setConfiguration(enabled ? "Single Technique selected. Demo mode on: a local synthetic run is available."
      : "Recovery test selected: requests deliberately fail while Demo mode is off.");
    if (single) inputRef.current?.focus();
  }

  async function runPipeline() {
    if (!source.canRunTask || requestRef.current || state.phase === "success") return;
    const selectedTechnique = technique.trim();
    if (!/^T\d{4}(?:\.\d{3})?$/.test(selectedTechnique)) {
      dispatch({ type: "error", message: "Enter an ATT&CK identifier such as T1059.001 before running the pipeline." });
      inputRef.current?.focus();
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    dispatch({ type: "start" });
    setCompletedTechnique("");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (!demoMode) headers["x-fail"] = "1";
      const response = await fetch("/run", { method: "POST", headers, signal: controller.signal,
        body: JSON.stringify({ technique: selectedTechnique, mode: demoMode ? "demo" : "controlled-failure" }) });
      if (!response.ok) throw new Error("Pipeline failed");
      const body: unknown = await response.json();
      if (!body || typeof body !== "object" || !("status" in body) || body.status !== "ok") throw new Error("Invalid local response");
      if (requestRef.current !== controller) return;
      setCompletedTechnique(selectedTechnique);
      dispatch({ type: "complete" });
    } catch {
      if (requestRef.current !== controller) return;
      // One observed health check for the recovery journey, not an endless failing poll.
      if (!controller.signal.aborted) {
        await fetch("/health", { headers: demoMode ? {} : { "x-fail": "1" }, signal: controller.signal }).catch(() => {});
      }
      if (requestRef.current !== controller) return;
      dispatch({ type: "error", message: demoMode
        ? "Pipeline failed: the local fixture endpoint did not return a valid response. Your technique is preserved. Retry the request."
        : "Pipeline failed in the deliberate recovery test. Enable Demo mode, then Retry to run the local synthetic pipeline." });
    } finally {
      clearTimeout(timeout);
      if (requestRef.current === controller) requestRef.current = null;
    }
  }

  return (
    <div className="aegis-shell" data-ztothez-product="aegisops">
      <aside className="product-nav" data-ztothez-fidelity="product-navigation" aria-label="SOC console navigation">
        <div className="nav-brand"><span aria-hidden="true">A</span><strong>AegisOps AI</strong><small>SOC OPERATOR</small></div>
        <p>SOC CONSOLE</p>
        <nav aria-label="AegisOPS sections">
          <a href="#mission" aria-current="page">Overview</a><a href="#mission">Alerts</a>
          <a href="#pipeline-result-heading">Cases</a><a href="#readiness">Threats</a>
          <a href="#mission">Hunting</a><a href="#data-boundary">Intel</a>
        </nav>
        <div className="endpoint-card"><small>Endpoint</small><strong>LOCAL FIXTURE</strong><span>demo only</span></div>
      </aside>
      <div className="aegis-stage">
        <div className="identity-banner" data-ztothez-fidelity="product-identity">
          <div><strong>AegisOps <em>AI</em></strong><span>PURPLE TEAMING &amp; SOC READINESS</span></div>
          <span className="demo-badge">OFFLINE · DEMO FALLBACK</span>
        </div>
        <div className="system-strip" data-ztothez-fidelity="system-status">
          <strong>LIVE MONITOR</strong><span>Endpoint: local fixture</span><span>Mode: bounded</span><span>Safety: pass</span>
        </div>
    <main className="workspace" data-ztothez-design-composition="1.0" data-ztothez-design-max-primary-actions="1" data-ztothez-design-max-visible-regions="4">
      <header className="product-header" data-ztothez-design-priority="context">
        <div>
          <p className="eyebrow">Operational decision workspace</p>
          <h1>{generatedPlan.product}</h1>
          <p className="lede">{generatedPlan.task.label}</p>
        </div>
        <span className="route-label">Route {generatedPlan.task.route}</span>
      </header>

      <section id="mission" className="decision-layout" aria-labelledby="decision-heading" data-ztothez-fidelity="mission-input">
        <form className="primary-flow" data-ztothez-design-region="primary-decision" aria-busy={state.phase === "running"} onSubmit={event => { event.preventDefault(); void runPipeline(); }}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Primary task</p>
              <h2 id="decision-heading">Run a single-technique demonstration</h2>
            </div>
            <span className={`status status--${state.phase}`} data-ztothez-design-status data-ztothez-design-status-purpose="task-phase" data-ztothez-design-state-visual data-ztothez-design-non-color-cue="visible-text">{state.phase}</span>
          </div>
          <div className="finding" data-ztothez-design-priority="primary-outcome" data-ztothez-design-visual-claim="selected-record" data-ztothez-design-claim-basis="synthetic" data-ztothez-design-evidence-ref="local-fixture-priority-record-01">
            <p className="finding-label">Selected record</p>
            <h3>{state.selectedRecord}</h3>
            <p>This synthetic record demonstrates the planned decision order without claiming production evidence.</p>
            <label className="technique-field"><span>ATT&amp;CK technique</span>
              <input ref={inputRef} className="technique-input" aria-label="ATT&CK technique or target" aria-describedby="technique-format" type="text" placeholder="e.g. T1059.001" value={technique} disabled={state.phase === "running"} onChange={event => {
                setTechnique(event.target.value); setCompletedTechnique(""); dispatch({ type: "return-to-review" });
              }} />
            </label>
            <p id="technique-format">Identifier format: T1059 or T1059.001.</p>
            <p role="status" className="configuration-status">{configuration}</p>
            <p>Local fixture only. No attack execution or production deployment.</p>
          </div>
          <div className="action-row" data-ztothez-design-priority="next-action">
            <p className="action-boundary"><strong>{source.label}</strong> · {source.origin}</p>
            <button aria-label="Run authorized simulation pipeline" className="primary-action" type="submit" data-ztothez-design-primary-action disabled={!source.canRunTask || state.phase === "running" || state.phase === "success"}>
              {state.phase === "running" ? "Running pipeline" : state.phase === "success" ? "Pipeline complete" : "Run Pipeline"}
            </button>
            <button type="button" aria-pressed={demoMode} disabled={state.phase === "running"} onClick={() => configureDemo(true, true)}>Single Technique</button>
            <button role="switch" aria-label="Enable Demo mode" aria-checked={demoMode} type="button" disabled={state.phase === "running"} onClick={() => configureDemo(!demoMode)}>Enable Demo mode: {demoMode ? "On" : "Off"}</button>
            {state.phase === "success" && (
              <button type="button" disabled={!/^T\d{4}(?:\.\d{3})?$/.test(completedTechnique)} onClick={() => {
                const artifact = createSyntheticSigma(completedTechnique);
                const a = document.createElement("a");
                a.href = `data:text/plain;charset=utf-8,${encodeURIComponent(artifact.body)}`;
                a.download = artifact.filename;
                a.click();
              }}>Download SIGMA</button>
            )}
            {state.phase === "error" && <p role="alert" className="action-boundary">{state.message}</p>}
            <div className="pipeline-meta" data-ztothez-fidelity="pipeline-status"><strong>Pipeline meta</strong><span>Artifacts: SIGMA example</span><span>Status: {state.phase}</span></div>
            <div id="readiness" className="readiness-grid" data-ztothez-fidelity="readiness-gates"><strong>READINESS GATES</strong><span>DEPLOYABLE ARTIFACTS: none</span><span>Coverage Gate: {state.phase === "success" ? "READY (local review)" : "Awaiting demonstration run"}</span><span>Safety: bounded</span></div>
            {state.phase !== "success" && <button type="button" disabled={!source.canRunTask || state.phase === "running"} onClick={() => void runPipeline()}>Retry</button>}
          </div>
          {state.phase === "success" && completedTechnique && <section className="pipeline-result" aria-labelledby="pipeline-result-heading">
            <h3 id="pipeline-result-heading">Pipeline result: {completedTechnique}</h3>
            <ol><li>Technique identifier validated: {completedTechnique}.</li><li>Local fixture endpoint acknowledged the request.</li><li>Synthetic SIGMA example prepared for download.</li></ol>
            <p>No detection was executed or tested against a real environment.</p>
          </section>}
          <ol className="answer-flow">
            {generatedPlan.informationFlow.map((entry) => (
              <li key={entry.id}><span>{entry.order}</span><div><strong>{entry.label}</strong><p>{entry.purpose}</p></div></li>
            ))}
          </ol>
        </form>

        <aside className="recovery" aria-labelledby="recovery-heading" data-ztothez-design-region="recovery">
          <p className="eyebrow">Recovery path</p>
          <h2 id="recovery-heading">Preserve context when a source is unavailable</h2>
          <p aria-live="polite" className="task-message">{state.message}</p>
          {!source.canRunTask && (
            <div className="recovery-actions">
              <button type="button" onClick={() => dispatch({ type: "retry-source" })}>Retry source</button>
              <button type="button" onClick={() => { selectSource("demo"); configureDemo(true); }}>Use disclosed demo fallback</button>
            </div>
          )}
          <p className="evidence-boundary">This fixture validates generated structure and state behavior. It does not prove live connectivity, rendered accessibility, product usability, or release readiness.</p>
        </aside>
      </section>

      <section id="data-boundary" data-ztothez-fidelity="data-boundary"><SourceBoundaryPanel mode={state.mode} onChange={selectSource} /></section>
    </main>
      </div>
    </div>
  );
}
