import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

test("V7 baseline rejects changed assertions even when journey step counts match", async () => {
  const root = await mkdtemp(join(tmpdir(), "ztde-v7-baseline-"));
  const script = resolve("scripts/capture-v7-baseline.mjs");
  const actions = [{ action: "expectText", selector: "h1", value: "Completed" }];
  async function fixture(directory: string, steps: unknown[], version = "2.0.0", benchmark = "scenestart") {
    const folder = join(directory, "knowledge-base/benchmarks", benchmark);
    await mkdir(folder, { recursive: true });
    await writeFile(join(directory, "package.json"), JSON.stringify({ version, scripts: {} }));
    await writeFile(join(folder, "journeys.json"), JSON.stringify({
      profiles: [{ id: "primary", journeys: [{ id: "task", steps }] }],
    }));
  }
  try {
    const baseline = join(root, "baseline");
    const current = join(root, "current");
    await fixture(baseline, actions);
    await fixture(current, actions);
    const run = () => spawnSync(process.execPath, [script, baseline], { cwd: current, encoding: "utf8" });
    assert.equal(run().status, 0);
    await fixture(current, [{ ...actions[0], value: "Loading" }]);
    assert.equal(run().status, 1);
    const report = JSON.parse(await readFile(join(current, ".ztothez-design-runtime/v7-baseline/v7-baseline-report.json"), "utf8"));
    assert.equal(report.status, "fail");
    assert.ok(report.sceneStart.differences.some((d: { kind: string }) => d.kind === "changed-action-coverage"));
    await fixture(current, [...actions, { action: "expectVisible", selector: "button" }]);
    assert.equal(run().status, 0);
    await fixture(baseline, actions, "2.0.0", "aegisops");
    await fixture(current, [{ ...actions[0], value: "Unexpected" }], "2.0.0", "aegisops");
    assert.equal(run().status, 1, 'Changes outside SceneStart must fail baseline qualification');
    await fixture(current, actions, "2.0.0", "aegisops");
    assert.equal(run().status, 0);
    await fixture(baseline, actions, "2.0.5");
    assert.equal(run().status, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("V7 shadow capture cannot qualify a product from only responsive evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "ztde-v7-shadow-"));
  try {
    for (const product of ["aegisops", "scenestart", "azure-optimizer"]) {
      const folder = join(root, product, "responsive-320");
      await mkdir(folder, { recursive: true });
      await writeFile(join(folder, "runtime-report.json"), JSON.stringify({
        passed: true, summary: { errors: 0 },
        viewports: [320, 375, 768, 1440].map(width => ({ width })),
      }));
    }
    const output = join(root, "output");
    const result = spawnSync(process.execPath, [resolve("scripts/capture-v7-shadow.mjs")], {
      encoding: "utf8",
      env: { ...process.env, ZTDE_V7_EVIDENCE_ROOT: root, ZTDE_V7_OUTPUT_ROOT: output },
    });
    assert.equal(result.status, 1, result.stderr);
    const report = JSON.parse(await readFile(join(output, "shadow-report.json"), "utf8"));
    assert.equal(report.overallStatus, "unresolved");
    for (const product of report.results.filter((r: { cohort: string }) => r.cohort === "development")) {
      assert.equal(product.supportedStatus, "pass");
      assert.equal(product.status, "unresolved");
      assert.ok(product.unsupportedRuleIds.includes("ZTDE-LIB-TOKEN-001"));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
