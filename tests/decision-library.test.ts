import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DecisionLibrary } from "../src/decision-library/library.js";
import { DecisionEngine } from "../src/decision-library/engine.js";
import { LibraryQualifier } from "../src/decision-library/qualification.js";
import { DesignRule } from "../src/decision-library/schema.js";

const baseRule: DesignRule = {
  id: "ZTDE-TEST-001",
  version: "1.0.0",
  title: "Test Rule",
  taskApplicability: ["*"],
  productApplicability: ["*"],
  platformApplicability: ["*"],
  statement: "This is a test rule.",
  threshold: { type: "quantitative", value: "5" },
  failureCondition: "Fails if signal is less than 5.",
  counterexample: "Signal is 4",
  confidence: "high",
  evidenceClass: "measured",
  verificationMethod: "automated",
  conflictPriority: 50,
  exceptionPolicy: "none",
  abstentionBehavior: "fail-closed",
  level: "mandatory",
  category: "structure"
};

test("DecisionEngine - numeric evaluation passes when >= threshold", () => {
  const engine = new DecisionEngine();
  const report = engine.evaluate("test-target", [baseRule], { structure: 6 });
  assert.equal(report.summary.passed, 1);
  assert.equal(report.results[0]?.outcome, "pass");
});

test("DecisionEngine - numeric evaluation fails when < threshold", () => {
  const engine = new DecisionEngine();
  const report = engine.evaluate("test-target", [baseRule], { structure: 4 });
  assert.equal(report.summary.failed, 1);
  assert.equal(report.results[0]?.outcome, "fail");
});

test("DecisionEngine - boolean evaluation passes on true, fails on false", () => {
  const boolRule: DesignRule = {
    ...baseRule,
    id: "ZTDE-TEST-BOOL",
    threshold: { type: "qualitative", value: "some-condition-met" }
  };
  const engine = new DecisionEngine();
  
  const passReport = engine.evaluate("test-target", [boolRule], { structure: true });
  assert.equal(passReport.summary.passed, 1);
  assert.equal(passReport.results[0]?.outcome, "pass");
  
  const failReport = engine.evaluate("test-target", [boolRule], { structure: false });
  assert.equal(failReport.summary.failed, 1);
  assert.equal(failReport.results[0]?.outcome, "fail");
});

test("DecisionEngine - qualitative evaluation passes on match, fails on mismatch", () => {
  const stringRule: DesignRule = {
    ...baseRule,
    id: "ZTDE-TEST-STR",
    threshold: { type: "qualitative", value: "expected-value" }
  };
  const engine = new DecisionEngine();
  
  const passReport = engine.evaluate("test-target", [stringRule], { structure: "expected-value" });
  assert.equal(passReport.summary.passed, 1);
  assert.equal(passReport.results[0]?.outcome, "pass");
  
  const failReport = engine.evaluate("test-target", [stringRule], { structure: "wrong-value" });
  assert.equal(failReport.summary.failed, 1);
  assert.equal(failReport.results[0]?.outcome, "fail");
});

test("DecisionEngine - unsupported signal type fails gracefully", () => {
  const unsupportedRule: DesignRule = {
    ...baseRule,
    threshold: { type: "qualitative", value: "expected-value" }
  };
  const engine = new DecisionEngine();
  // Provide numeric signal when threshold is qualitative
  const report = engine.evaluate("test-target", [unsupportedRule], { structure: 42 });
  assert.equal(report.summary.failed, 1);
  assert.equal(report.results[0]?.outcome, "fail");
});

test("DecisionEngine - abstentionBehavior: fail-closed", () => {
  const engine = new DecisionEngine();
  const report = engine.evaluate("test-target", [baseRule], {});
  assert.equal(report.summary.failed, 1);
  assert.equal(report.results[0]?.outcome, "fail");
  assert.match(report.results[0]?.reason!, /fail-closed/);
});

test("DecisionEngine - abstentionBehavior: abstain-if-no-signal", () => {
  const abstainRule: DesignRule = {
    ...baseRule,
    id: "ZTDE-TEST-004",
    abstentionBehavior: "abstain-if-no-signal"
  };
  const engine = new DecisionEngine();
  const report = engine.evaluate("test-target", [abstainRule], {});
  assert.equal(report.summary.abstained, 1);
  assert.equal(report.results[0]?.outcome, "abstain");
});

test("DecisionEngine - priority orders independent rules without changing their outcomes", () => {
  const ruleLowPriority: DesignRule = {
    ...baseRule,
    id: "ZTDE-TEST-LOW",
    threshold: { type: "qualitative", value: "val" },
    conflictPriority: 10
  };
  const ruleHighPriority: DesignRule = {
    ...baseRule,
    id: "ZTDE-TEST-HIGH",
    threshold: { type: "qualitative", value: "other-val" },
    conflictPriority: 90
  };
  
  const engine = new DecisionEngine();
  // The signal matches the low priority rule (val) but fails the high priority rule (other-val)
  // Sharing a category does not make separate requirements interchangeable.
  const report = engine.evaluate("test-target", [ruleLowPriority, ruleHighPriority], { structure: "val" });
  
  assert.equal(report.summary.total, 2);
  const lowRes = report.results.find(r => r.ruleId === "ZTDE-TEST-LOW");
  const highRes = report.results.find(r => r.ruleId === "ZTDE-TEST-HIGH");
  
  assert.equal(highRes?.outcome, "fail");
  assert.equal(lowRes?.outcome, "pass");
  assert.equal(report.results[0]?.ruleId, ruleHighPriority.id);
});

test("DecisionEngine - passing high priority rule cannot erase a failed measurement", () => {
  const low = { ...baseRule, id: "ZTDE-TEST-LOW", conflictPriority: 10 };
  const high = { ...baseRule, id: "ZTDE-TEST-HIGH", conflictPriority: 90 };
  const report = new DecisionEngine().evaluate("test", [low, high], {
    [low.id]: 1,
    [high.id]: 6,
  });
  assert.equal(report.results.find(r => r.ruleId === low.id)?.outcome, "fail");
  assert.equal(report.summary.failed, 1);
  assert.equal(report.summary.passed, 1);
});

test("DecisionEngine - quantitative rules reject booleans and non-finite measurements", () => {
  for (const signal of [true, Infinity, NaN, "Infinity", ""]) {
    const report = new DecisionEngine().evaluate("test", [baseRule], { [baseRule.id]: signal });
    assert.equal(report.summary.failed, 1, `Unexpected pass for ${String(signal)}`);
  }
});

test("qualification cannot pass with missing fail-closed evidence or absent expected rules", () => {
  const library = new DecisionLibrary();
  library.addRule(baseRule);
  const qualifier = new LibraryQualifier(library);
  const missing = qualifier.qualifyProduct({ productId: "fixture", taskType: "dashboard", signals: {} });
  assert.equal(missing.failedCount, 1);
  assert.equal(missing.passed, false);
  const unknown = qualifier.qualifyProduct({
    productId: "fixture", taskType: "dashboard", signals: { [baseRule.id]: 6 },
    expectedOutcomes: { "ZTDE-NOT-EVALUATED": "pass" },
  });
  assert.equal(unknown.falseClaimCount, 1);
  assert.equal(unknown.passed, false);
});

test("DecisionEngine - no rules evaluated yields empty report", () => {
  const engine = new DecisionEngine();
  const report = engine.evaluate("test-target", [], { structure: "val" });
  
  assert.equal(report.summary.total, 0);
  assert.equal(report.summary.passed, 0);
  assert.equal(report.summary.failed, 0);
  assert.equal(report.summary.abstained, 0);
  assert.equal(report.results.length, 0);
});

test("DecisionEngine - upper limits and bounded counts reject out-of-range measurements", () => {
  const engine = new DecisionEngine();
  const rule: DesignRule = { ...baseRule, threshold: {
    type: "quantitative", value: "3", comparison: "at-most", minimum: 1,
  } };
  for (const [signal, outcome] of [[0, "fail"], [1, "pass"], [3, "pass"], [4, "fail"], ["4", "fail"]] as const) {
    assert.equal(engine.evaluate("test", [rule], { [rule.id]: signal }).results[0]?.outcome, outcome);
  }
  const reflow: DesignRule = { ...rule, threshold: { type: "quantitative", value: "320", comparison: "at-most", minimum: 1 } };
  assert.equal(engine.evaluate("test", [reflow], { [reflow.id]: 375 }).summary.failed, 1);
  assert.equal(engine.evaluate("test", [reflow], { [reflow.id]: 320 }).summary.passed, 1);
});

test("DecisionLibrary rejects repository symlink escapes and invalid rule insertion", () => {
  const root = mkdtempSync(join(tmpdir(), "ztde-library-"));
  try {
    const repo = join(root, "repo");
    mkdirSync(join(repo, "model"), { recursive: true });
    const outside = join(root, "outside.json");
    writeFileSync(outside, JSON.stringify([baseRule]));
    symlinkSync(outside, join(repo, "model", "decision-library.json"));
    const library = new DecisionLibrary();
    assert.throws(() => library.loadFromRepository(repo), /escapes repository/);
    assert.throws(() => library.addRule({ ...baseRule, id: "invalid" }));
    assert.equal(library.getAllRules().length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
