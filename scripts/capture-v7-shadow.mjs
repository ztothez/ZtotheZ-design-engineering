import { readFile, mkdir, writeFile, realpath } from "node:fs/promises";
import { join, resolve, relative, isAbsolute, sep } from "node:path";
import { tmpdir } from "node:os";

const projectRoot = resolve(".");
const evidenceRoot = resolve(process.env.ZTDE_V7_EVIDENCE_ROOT ?? ".ztothez-design-runtime/v7-rerun-20260902");
const outputRoot = resolve(process.env.ZTDE_V7_OUTPUT_ROOT ?? ".ztothez-design-runtime/v7-shadow-qualification");
const contains = (root, path) => { const rel = relative(root, path); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`); };
const privateRoots = [resolve('.ztothez-design-runtime'), resolve(tmpdir())];
if (!privateRoots.some(root => contains(root, outputRoot))) throw new Error('Shadow output must remain in private runtime or temporary storage');
const products = [
  { id: "AegisOPS", directory: "aegisops", profile: "responsive-320", cohort: "development" },
  { id: "SceneStart", directory: "scenestart", profile: "responsive-320", cohort: "development" },
  { id: "Azure Optimizer", directory: "azure-optimizer", profile: "responsive-320", cohort: "development" },
];

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function evaluateProduct(product, library, extractRuntimeSignals, DecisionEngine) {
  const profile = product.profile ?? "responsive-overview";
  const relativeEvidencePath = join(product.directory, profile, "runtime-report.json");
  try {
    const evidence = extractRuntimeSignals(
      await readJson(join(evidenceRoot, relativeEvidencePath)),
      relativeEvidencePath,
      profile,
    );
    const rules = library.getAllRules().filter((rule) => evidence.supportedRuleIds.includes(rule.id));
    const unsupportedRuleIds = library.getAllRules()
      .filter((rule) => !evidence.supportedRuleIds.includes(rule.id))
      .map((rule) => rule.id);
    const decisionReport = new DecisionEngine().evaluate(`${product.id}:${profile}`, rules, evidence.signals);
    const supportedStatus = decisionReport.summary.failed > 0 ? "fail"
      : rules.length === 0 || decisionReport.summary.abstained > 0 ? "unresolved" : "pass";
    return {
      product: product.id,
      cohort: product.cohort,
      status: supportedStatus === "fail" ? "fail"
        : supportedStatus === "pass" && unsupportedRuleIds.length === 0 ? "pass" : "unresolved",
      supportedStatus,
      supportedRules: rules.map((rule) => rule.id),
      unsupportedRuleIds,
      signals: evidence.signals,
      evidencePaths: evidence.evidencePaths,
      decisionReport,
      unsupportedCategories: evidence.unsupportedCategories,
      limitations: evidence.limitations,
    };
  } catch (error) {
    return {
      product: product.id,
      cohort: product.cohort,
      status: "unresolved",
      supportedStatus: "unresolved",
      supportedRules: [],
      unsupportedRuleIds: library.getAllRules().map((rule) => rule.id),
      signals: {},
      evidencePaths: [relativeEvidencePath],
      unsupportedCategories: ["responsive"],
      limitations: [`Responsive evidence unavailable: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

async function main() {
  const [{ DecisionLibrary }, { DecisionEngine }, { extractRuntimeSignals }] = await Promise.all([
    import("../dist/src/decision-library/library.js"),
    import("../dist/src/decision-library/engine.js"),
    import("../dist/src/decision-library/evidence.js"),
  ]);
  const library = new DecisionLibrary();
  library.loadFromRepository(projectRoot);
  const results = [];
  if (process.env.ZTDE_V7_PILOT_REPORT) {
    const { evaluatePilotCapture } = await import('../dist/src/decision-library/pilot-evidence.js');
    const { readBoundedEvidence } = await import('../dist/src/decision-library/observations.js');
    const bundles = process.env.ZTDE_V7_PILOT_BUNDLES
      ? JSON.parse((await readBoundedEvidence(resolve('.ztothez-design-runtime'), process.env.ZTDE_V7_PILOT_BUNDLES)).toString('utf8'))
      : undefined;
    results.push(...await evaluatePilotCapture({ projectRoot, evidenceRoot: resolve('.ztothez-design-runtime'),
      path: process.env.ZTDE_V7_PILOT_REPORT, library, ...(bundles ? { bundles } : {}) }));
  } else {
    for (const product of products) results.push(await evaluateProduct(product, library, extractRuntimeSignals, DecisionEngine));
  }
  let holdout;
  if (process.env.ZTDE_V7_HOLDOUT_REPORT) {
    const { evaluatePrivateHoldout } = await import('../dist/src/decision-library/holdout.js');
    const { readBoundedEvidence } = await import('../dist/src/decision-library/observations.js');
    try {
      holdout = await evaluatePrivateHoldout({
        registryRoot: resolve('.ztothez-design-local'), registryPath: 'portfolio-registry.yaml',
        evidenceRoot: resolve('.ztothez-design-benchmarks'), reportPath: process.env.ZTDE_V7_HOLDOUT_REPORT,
        library,
        ...(process.env.ZTDE_V7_HOLDOUT_BUNDLES ? { bundles: JSON.parse((await readBoundedEvidence(
          resolve('.ztothez-design-benchmarks'), process.env.ZTDE_V7_HOLDOUT_BUNDLES)).toString('utf8')) } : {}),
      });
    } catch {
      holdout = { status: 'unresolved', limitation: 'Private holdout evidence is missing, stale, unsafe, or invalid.' };
    }
  }
  results.push({
    product: "private-holdout-cohort",
    cohort: "holdout",
    status: holdout?.status ?? "unresolved",
    supportedStatus: "unresolved",
    supportedRules: [],
    unsupportedRuleIds: library.getAllRules().map((rule) => rule.id),
    signals: {},
    evidencePaths: [],
    unsupportedCategories: ["responsive"],
    limitations: ["Private holdout qualification is opt-in; raw evidence is never exposed through MCP."],
    ...(holdout ? { privateQualification: holdout } : {}),
  });
  const report = {
    version: "1.1",
    generatedAt: new Date().toISOString(),
    evaluationTarget: "V7 Decision Library",
    evidenceRoot: "private-runtime-evidence",
    results,
    overallStatus: results.some((result) => result.status === "fail") ? "fail" : results.every((result) => result.status === "pass") ? "pass" : "unresolved",
  };
  await mkdir(outputRoot, { recursive: true });
  const actualOutput = await realpath(outputRoot);
  if (!privateRoots.some(root => contains(root, actualOutput))) throw new Error('Shadow output symlink escapes private storage');
  await writeFile(join(outputRoot, "shadow-report.json"), JSON.stringify(report, null, 2), "utf8");
  console.error(`V7 shadow evaluation written to ${join(outputRoot, "shadow-report.json")}`);
  process.exitCode = report.overallStatus === "pass" ? 0 : 1;
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
