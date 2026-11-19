import { useEffect, useReducer, useRef, useState } from "react";

import { generatedPlan } from "../generated/plan";
import { sourceBoundaries } from "../domain/source-mode";
import { initialTaskState, taskReducer } from "../domain/task-state";
import { SourceBoundaryPanel } from "./SourceBoundaryPanel";
import { analyzeDemonstration } from "../domain/analysis";
import type { DataMode } from "../domain/source-mode";

export function TaskWorkspace() {
  const [state, dispatch] = useReducer(taskReducer, initialTaskState);
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [analysis, setAnalysis] = useState<ReturnType<typeof analyzeDemonstration> | null>(null);
  const analysisHeading = useRef<HTMLHeadingElement>(null);
  const source = sourceBoundaries[state.mode];
  useEffect(() => { if (analysisVisible) analysisHeading.current?.focus(); }, [analysisVisible]);

  function runTask() {
    if (!analysisVisible || !source.canRunTask || state.phase === "running" || state.phase === "success") return;
    dispatch({ type: "start" });
    setAnalysis(analyzeDemonstration(state.mode));
    dispatch({ type: "complete" });
  }

  function selectSource(mode: DataMode) {
    setAnalysis(null);
    dispatch({ type: "select-mode", mode });
  }

  function returnToReview() {
    setAnalysis(null); setAnalysisVisible(false);
    dispatch({ type: "return-to-review" });
  }

  return (
    <div className="azure-shell" data-ztothez-product="azure-optimizer">
      <aside className="product-nav" data-ztothez-fidelity="product-navigation" aria-label="Azure Optimizer navigation">
        <div className="nav-brand"><span aria-hidden="true">AZ</span><strong>Azure Optimizer</strong></div>
        <nav aria-label="Optimizer sections">
          <a href="#overview" aria-current="page">Overview</a><a href="#analysis-panel">Analysis</a>
          <a href="#recommendations">Resources</a><a href="#recommendations">Recommendations</a>
          <a href="#data-boundary">Reports</a><a href="#data-boundary">Settings</a>
        </nav>
      </aside>
      <div className="azure-stage">
    <main className="workspace" data-ztothez-design-composition="1.0" data-ztothez-design-max-primary-actions="1" data-ztothez-design-max-visible-regions="4">
      <header id="overview" className="product-header" data-ztothez-design-priority="context" data-ztothez-fidelity="product-identity">
        <div>
          <p className="eyebrow">Azure estate optimization</p>
          <h1>{generatedPlan.product}</h1>
          <p className="lede">{generatedPlan.task.label}</p>
        </div>
        <span className="route-label">Route {generatedPlan.task.route}</span>
      </header>

      <section className="decision-layout" aria-labelledby="decision-heading">
        <div className="primary-flow" data-ztothez-design-region="primary-decision">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Overview</p>
              <h2 id="decision-heading">Potential Savings</h2>
            </div>
            <span className={`status status--${state.phase}`} data-ztothez-design-status data-ztothez-design-status-purpose="task-phase" data-ztothez-design-state-visual data-ztothez-design-non-color-cue="visible-text">{state.phase}</span>
          </div>
          <dl className="source-facts metric-summary" aria-label="Local demonstration summary" data-ztothez-fidelity="metric-summary">
            <div><dt>Tracked resources</dt><dd>24</dd></div>
            <div><dt>Potential monthly savings</dt><dd>EUR 1,240</dd></div>
            <div><dt>Current findings</dt><dd>3</dd></div>
          </dl>
          <div id="recommendations" className="finding" data-ztothez-fidelity="recommendations" data-ztothez-design-priority="primary-outcome" data-ztothez-design-visual-claim="selected-record" data-ztothez-design-claim-basis="synthetic" data-ztothez-design-evidence-ref="local-fixture-priority-record-01">
            <p className="finding-label">Top Recommendations</p>
            <h3>Right-size {state.selectedRecord}</h3>
            <p>Local fixture evidence indicates sustained low utilization. Validate a smaller instance class in a non-production environment before changing capacity.</p>
            <p><strong>Limitation:</strong> This estimate is demonstration data and does not describe a connected Azure tenant.</p>
          </div>
          <div className="action-row" data-ztothez-design-priority="next-action" data-ztothez-fidelity="analysis-results">
            <p className="action-boundary"><strong>{source.label}</strong> · {source.origin}</p>
            <button type="button" aria-controls="analysis-panel" aria-expanded={analysisVisible} onClick={() => setAnalysisVisible(visible => !visible)}>Analysis</button>
            <button className="primary-action" type="button" data-ztothez-design-primary-action onClick={runTask} disabled={!analysisVisible || !source.canRunTask || state.phase === "running" || state.phase === "success"}>
              {state.phase === "running" ? "Running AI audit" : state.phase === "success" ? "Analysis complete" : "Run AI Audit"}
            </button>
            <button type="button" onClick={returnToReview}>Return to review</button>
          </div>
          <section id="analysis-panel" className="analysis-panel" hidden={!analysisVisible} aria-labelledby="analysis-heading">
            <h3 id="analysis-heading" ref={analysisHeading} tabIndex={-1}>Resource analysis</h3>
            <p>Local rules-only demonstration. No AI service, Azure connection, or resource changes.</p>
            {!source.canRunTask ? <p role="status">{source.limitation}</p> : analysis ? <>
              <p role="status">Analysis results: {analysis.findings.length} synthetic findings. Potential monthly savings: EUR {analysis.monthlySavings.toLocaleString('en-US')}.</p>
              <ol className="analysis-findings">{analysis.findings.map(finding => <li key={finding.resource}>
                <h4>{finding.resource}: EUR {finding.monthlySavings}/month</h4>
                <p>{finding.observation}</p><p><strong>Recommendation:</strong> {finding.recommendation}</p>
                <details><summary>Validation for {finding.resource}</summary><p>{finding.validation}</p></details>
              </li>)}</ol>
            </> : <p role="status">Ready to evaluate three synthetic optimization candidates in the 24-resource demonstration estate. No audit has run yet.</p>}
          </section>
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
              <button type="button" onClick={() => { setAnalysis(null); dispatch({ type: "use-demo-fallback" }); }}>Use disclosed demo fallback</button>
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
