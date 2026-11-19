import { readFile, writeFile, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, relative, isAbsolute, sep } from "node:path";
import { ruleFingerprint, canonical } from "../dist/src/decision-library/provenance.js";
import { DesignRuleSchema } from "../dist/src/decision-library/schema.js";

const root = await realpath(new URL("..", import.meta.url));
const target = resolve(root, "model/decision-library.json");
const rationale = {
  "A11Y-001": "Reconcile contrast advice with the normal-text measurement floor; broader accessibility needs separate evidence.",
  "A11Y-002": "Use the skill's 44-pixel touch recommendation as a conservative project target, not a universal statutory minimum.",
  "A11Y-003": "Require task-specific keyboard observation; focusability alone cannot prove that controls operate.",
  "A11Y-004": "Require observation of state announcements; DOM markers alone cannot establish assistive-technology behavior.",
  "A11Y-005": "Retain motion-alternative review as an explicit requirement without declaring completion from an emulation flag.",
  "RESP-001": "Bind narrow-layout evaluation to measured supported width and explicit overflow/reachability evidence.",
  "RESP-002": "Retain a minimum multiple-width verification policy; viewport count does not establish all responsive behavior.",
  "STATE-001": "Translate state-design guidance into a reviewable transition-definition obligation with chronology evidence.",
  "STATE-002": "Require a failure-and-recovery journey that observes preserved user data rather than a state-name declaration.",
  "TOKEN-001": "Translate semantic-token guidance into a source-review requirement with documented exceptions.",
  "TOKEN-002": "Retain the existing one-to-three emphasis budget as a review heuristic, not an externally mandated threshold.",
  "HIER-001": "Retain a single-primary-heading project convention, checked on rendered pages rather than claimed as universal law.",
  "HIER-002": "Require acceptance criteria tied to observable outcomes and explicit validation methods.",
  "TRUTH-001": "Carry evidence classes with claims so automated and owner/user observations cannot be conflated.",
  "TRUTH-002": "Require impact-based severity reasoning, retaining uncertainty where user-impact evidence is unavailable.",
  "TRUTH-003": "Require handoff manifests to enumerate deliverables and unresolved gaps before acceptance.",
  "MAINT-001": "Translate explicit component ownership guidance into a review of state and dependency boundaries.",
  "MAINT-002": "Require stage entry prerequisites to be validated; successful later output does not prove the earlier gate existed.",
};
const sourcePaths = ["SKILL.md", "knowledge-base/maintained/architecture/component-boundaries.md",
  "knowledge-base/maintained/architecture/quality-attributes-and-evaluation.md",
  "knowledge-base/maintained/product-patterns/operational-dashboards.md"];
const sources = [];
for (const path of sourcePaths) {
  const actual = await realpath(resolve(root, path));
  const rel = relative(root, actual);
  if (isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`)) throw new Error("Source escapes repository");
  sources.push({ path, sha256: createHash("sha256").update(await readFile(actual)).digest("hex") });
}
const original = JSON.parse(await readFile(target, "utf8"));
const compiled = original.map(value => {
  const { provenance: ignored, ...body } = value;
  const rule = DesignRuleSchema.parse(body);
  const reason = rationale[rule.id.replace(/^ZTDE-LIB-/, "")];
  if (!reason) throw new Error("Missing individual rule reconciliation record");
  return { ...rule, provenance: { version: "1.0", method: "policy-reconciliation", reviewerClass: "ai-assisted",
    authority: "project-policy", rationale: reason, sources, ruleSha256: ruleFingerprint(rule) } };
});
if (process.argv.includes("--write")) await writeFile(target, `${JSON.stringify(compiled, null, 2)}\n`);
else if (canonical(original) !== canonical(compiled)) throw new Error("Decision provenance drift; review changes before --write");
console.error(JSON.stringify({ status: "pass", rules: compiled.length, method: "policy-reconciliation", historicalAuthorshipCertified: false }));
