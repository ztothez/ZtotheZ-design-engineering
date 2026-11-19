import assert from "node:assert/strict";
import test from "node:test";
import { DecisionLibrary } from "../src/decision-library/library.js";
import { LibraryQualifier, QualificationFixture } from "../src/decision-library/qualification.js";
import { extractRuntimeSignals } from "../src/decision-library/evidence.js";

test("LibraryQualifier - should evaluate real fixtures", () => {
  const library = new DecisionLibrary();
  
  // Add a test rule mimicking the actual library rule ZTDE-LIB-A11Y-001
  library.addRule({
    id: "ZTDE-LIB-A11Y-001",
    version: "1.0.0",
    title: "Sufficient Color Contrast",
    taskApplicability: ["*"],
    productApplicability: ["*"],
    platformApplicability: ["*"],
    statement: "Text and interactive elements must meet the WCAG AA minimum contrast ratio...",
    threshold: { type: "quantitative", value: "4.5", unit: "contrast-ratio" },
    failureCondition: "Any text element has a contrast ratio below 4.5:1...",
    counterexample: "Light grey text on white background.",
    confidence: "high",
    evidenceClass: "measured",
    verificationMethod: "automated",
    conflictPriority: 90,
    exceptionPolicy: "Decorative text exempt.",
    abstentionBehavior: "fail-closed",
    level: "mandatory",
    category: "accessibility"
  });

  const qualifier = new LibraryQualifier(library);
  
  const fixture: QualificationFixture = {
    productId: "test-product",
    taskType: "dashboard",
    signals: {
      "accessibility": 5.0 // Passes threshold of 4.5
    },
    expectedOutcomes: {
      "ZTDE-LIB-A11Y-001": "pass"
    }
  };

  const result = qualifier.qualifyProduct(fixture);
  
  assert.equal(result.totalRules, 1);
  assert.equal(result.passedCount, 1);
  assert.equal(result.falseClaimCount, 0);
  assert.equal(result.passed, true);
});

test("LibraryQualifier - should catch false claims", () => {
  const library = new DecisionLibrary();
  
  library.addRule({
    id: "ZTDE-LIB-RESP-001",
    version: "1.0.0",
    title: "Content Reflow Without Loss",
    taskApplicability: ["*"],
    productApplicability: ["*"],
    platformApplicability: ["web"],
    statement: "When viewport narrows, content must reflow...",
    threshold: { type: "quantitative", value: "320" },
    failureCondition: "Overflow at 320px",
    counterexample: "Fixed table clips content",
    confidence: "high",
    evidenceClass: "measured",
    verificationMethod: "automated",
    conflictPriority: 80,
    exceptionPolicy: "Data tables may use horizontal scrolling.",
    abstentionBehavior: "fail-closed",
    level: "mandatory",
    category: "responsive"
  });

  const qualifier = new LibraryQualifier(library);
  
  const fixture: QualificationFixture = {
    productId: "test-product",
    taskType: "form",
    signals: {
      "responsive": 300 // Fails threshold of 320
    },
    expectedOutcomes: {
      "ZTDE-LIB-RESP-001": "pass" // We expect it to pass, but it will fail -> false claim
    }
  };

  const result = qualifier.qualifyProduct(fixture);
  
  assert.equal(result.totalRules, 1);
  assert.equal(result.failedCount, 1);
  assert.equal(result.falseClaimCount, 1); // Expected pass, got fail
  assert.equal(result.passed, false);
});

test("runtime evidence adapter emits only a directly supported responsive signal", () => {
  const evidence = extractRuntimeSignals(
    { passed: true, viewports: [{ width: 320 }], summary: { errors: 0 } },
    "runtime/responsive-report.json",
    "responsive-overview",
  );

  assert.deepEqual(evidence.signals, { "ZTDE-LIB-RESP-002": 1, "ZTDE-LIB-RESP-001": 320 });
  assert.deepEqual(evidence.supportedCategories, ["responsive"]);
  assert.deepEqual(evidence.supportedRuleIds, ["ZTDE-LIB-RESP-002", "ZTDE-LIB-RESP-001"]);
  assert.ok(evidence.unsupportedCategories.includes("accessibility"));
});

test("runtime evidence adapter abstains for profiles that do not establish responsiveness", () => {
  const evidence = extractRuntimeSignals(
    { passed: true, viewports: [{ width: 1440 }], summary: { errors: 0 } },
    "runtime/overview-report.json",
    "demo-success",
  );

  assert.deepEqual(evidence.signals, {});
  assert.equal(evidence.supportedCategories.length, 0);
});

test("runtime evidence adapter rejects unproven legacy rule signals", () => {
  const evidence = extractRuntimeSignals(
    {
      passed: true,
      viewports: [{ width: 375 }, { width: 768 }, { width: 1440 }],
      summary: { errors: 0 },
      decisionSignals: {
        "ZTDE-LIB-TOKEN-001": "no-raw-values-in-component-styles",
        accessibility: true,
      },
    },
    "runtime/qualified-report.json",
    "responsive-overview",
  );

  assert.equal(evidence.signals["ZTDE-LIB-TOKEN-001"], undefined);
  assert.ok(!Object.hasOwn(evidence.signals, "accessibility"));
  assert.ok(!evidence.supportedRuleIds.includes("ZTDE-LIB-TOKEN-001"));
  assert.ok(evidence.limitations.some(message => message.includes("provenance")));
});

test("V7 admits numeric browser samples but abstains on incomplete passing coverage", () => {
  const viewport = { name: "mobile", width: 375 };
  const finding = { checkId: "ZTDE-RUNTIME-011-MEASURED", viewport: "mobile",
    measurement: { version: "1.0", kind: "normal-text-contrast", minimum: 7, measuredCount: 4, skippedCount: 0 } };
  const report = { passed: true, viewports: [viewport], summary: { errors: 0 }, findings: [finding] };
  const read = (value: unknown) => extractRuntimeSignals(value, "report.json", "demo-success");
  assert.equal(read(report).signals["ZTDE-LIB-A11Y-001"], 7);
  assert.equal(read({ ...report, viewports: [viewport, { name: "desktop", width: 1440 }] }).signals["ZTDE-LIB-A11Y-001"], undefined);
  assert.equal(read({ ...report, colorSchemes: ["light", "dark"] }).signals["ZTDE-LIB-A11Y-001"], undefined);
  assert.equal(read({ ...report, findings: [{ ...finding, measurement: { ...finding.measurement, skippedCount: 1 } }] }).signals["ZTDE-LIB-A11Y-001"], undefined);
  assert.equal(read({ ...report, findings: [{ ...finding, measurement: { ...finding.measurement, minimum: 2, skippedCount: 1 } }] }).signals["ZTDE-LIB-A11Y-001"], 2);
  assert.throws(() => read({ ...report, findings: [{ ...finding, measurement: { ...finding.measurement, minimum: null } }] }));
  assert.equal(read({ ...report, findings: [{ ...finding, checkId: "page-claims-pass" }] }).signals["ZTDE-LIB-A11Y-001"], undefined);
});

test("V7 target evidence uses the measured dimension, not the verifier's lower warning threshold", () => {
  const result = extractRuntimeSignals({ passed: true, summary: { errors: 0 }, viewports: [{ name: "mobile", width: 375 }], findings: [
    { checkId: "ZTDE-RUNTIME-012-MEASURED", viewport: "mobile", measurement: {
      version: "1.0", kind: "effective-target-size", minimum: 32, measuredCount: 2, skippedCount: 0,
    } },
  ] }, "report.json", "demo-success");
  assert.equal(result.signals["ZTDE-LIB-A11Y-002"], 32);
  assert.equal(result.signals["ZTDE-LIB-A11Y-003"], undefined);
});

test("qualification does not pass when required rules abstain", () => {
  const library = new DecisionLibrary();
  library.addRule({
    id: "ZTDE-TEST-ABSTAIN",
    version: "1.0.0",
    title: "Evidence Required",
    taskApplicability: ["*"],
    productApplicability: ["*"],
    platformApplicability: ["*"],
    statement: "A direct signal is required before this rule can pass.",
    threshold: { type: "qualitative", value: "verified" },
    failureCondition: "The direct signal contradicts the required evidence.",
    counterexample: "No measurement or observation was retained.",
    confidence: "high",
    evidenceClass: "measured",
    verificationMethod: "automated",
    conflictPriority: 50,
    exceptionPolicy: "none",
    abstentionBehavior: "abstain-if-no-signal",
    level: "mandatory",
    category: "accessibility",
  });

  const result = new LibraryQualifier(library).qualifyProduct({
    productId: "test-product",
    taskType: "dashboard",
    signals: {},
  });

  assert.equal(result.abstainedCount, 1);
  assert.equal(result.passed, false);
});
