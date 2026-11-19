import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { evaluateProductFidelity } from "../src/product-fidelity/evaluator.js";
import { loadProductFidelityContract } from "../src/product-fidelity/loader.js";
import {
  requireLoopbackProductFidelityUrl,
  resolveProductFidelityOutput,
} from "../src/product-fidelity/policy.js";
import { productFidelityContractSchema } from "../src/product-fidelity/schema.js";

const products = ["aegisops", "scenestart", "azure-optimizer"];

test("candidate product-fidelity fixture contracts are strict, complete, and owner-bounded", async () => {
  for (const product of products) {
    const { contract, sha256 } = await loadProductFidelityContract(
      `tests/fixtures/product-fidelity/${product}.yaml`,
    );
    assert.equal(contract.productId, product);
    assert.equal(contract.reference.kind, "owner-controlled-public-product");
    assert.equal(contract.humanReview.required, true);
    assert.equal(contract.documentOrder.length, contract.requiredCues.length);
    assert.match(sha256, /^[a-f0-9]{64}$/);
  }
});

test("contract rejects unknown order cues and duplicate cue identities", () => {
  const base = {
    version: "1.0",
    productId: "sample",
    scope: "repository-owned-product-fidelity",
    route: "/",
    reference: {
      kind: "owner-controlled-public-product",
      url: "https://example.com/product",
      observedAt: "2026-09-11",
      evidenceBoundary: "Owner-controlled visual reference with no source-code transfer.",
    },
    requiredCues: ["one", "two", "three", "four"].map((id) => ({
      id,
      selector: `[data-cue=${id}]`,
      purpose: `A sufficiently concrete purpose for ${id}.`,
    })),
    documentOrder: ["one", "two", "three", "unknown"],
    requiredViewports: [
      { id: "mobile", width: 375, height: 812 },
      { id: "desktop", width: 1440, height: 1000 },
    ],
    humanReview: {
      required: true,
      categories: ["brand-fit", "information-hierarchy", "domain-fit"],
    },
  };
  assert.equal(productFidelityContractSchema.safeParse(base).success, false);
  assert.equal(productFidelityContractSchema.safeParse({
    ...base,
    requiredCues: [...base.requiredCues.slice(0, 3), base.requiredCues[0]],
    documentOrder: ["one", "two", "three"],
  }).success, false);
});

test("contract and output paths reject traversal and symlink escape", async () => {
  const allowedRoot = await mkdtemp(join(tmpdir(), "ztde-fidelity-allowed-"));
  const outsideRoot = await mkdtemp(join(tmpdir(), "ztde-fidelity-outside-"));
  try {
    const source = await readFile("tests/fixtures/product-fidelity/aegisops.yaml", "utf8");
    const outsideContract = join(outsideRoot, "outside.yaml");
    await writeFile(outsideContract, source);
    await symlink(outsideContract, join(allowedRoot, "escaped.yaml"));
    await symlink(outsideRoot, join(allowedRoot, "escaped-output"));

    await assert.rejects(
      loadProductFidelityContract(outsideContract, allowedRoot),
      /escapes the allowed root/,
    );
    await assert.rejects(
      loadProductFidelityContract("escaped.yaml", allowedRoot),
      /resolves outside the allowed root/,
    );
    await assert.rejects(
      resolveProductFidelityOutput("escaped-output/report", allowedRoot),
      /resolves outside the allowed root/,
    );
  } finally {
    await rm(allowedRoot, { recursive: true, force: true });
    await rm(outsideRoot, { recursive: true, force: true });
  }
});

test("product-fidelity runtime verification rejects non-loopback targets", () => {
  assert.throws(
    () => requireLoopbackProductFidelityUrl("https://example.com/product"),
    /only loopback runtime URLs/,
  );
  assert.equal(requireLoopbackProductFidelityUrl("http://127.0.0.1:4173/").hostname, "127.0.0.1");
});

test("browser evaluator passes declared cues and fails a missing product signal", async () => {
  const loaded = await loadProductFidelityContract("tests/fixtures/product-fidelity/aegisops.yaml");
  let omitCue = false;
  const server = createServer((_request, response) => {
    const elements = loaded.contract.documentOrder
      .filter((id) => !omitCue || id !== "product-identity")
      .map((id) => `<section data-ztothez-fidelity="${id}">${id}</section>`)
      .join("");
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(`<style>*{box-sizing:border-box}body{margin:0}section{min-height:44px;padding:8px}</style>${elements}`);
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const root = await mkdtemp(join(tmpdir(), "ztde-fidelity-"));
  try {
    const pass = await evaluateProductFidelity({
      ...loaded,
      contractSha256: loaded.sha256,
      url: `http://127.0.0.1:${address.port}/`,
      outputDirectory: join(root, "pass"),
      rootDirectory: root,
    });
    assert.equal(pass.automatedResult, "pass");
    assert.equal(pass.humanReview, "required");

    omitCue = true;
    const fail = await evaluateProductFidelity({
      ...loaded,
      contractSha256: loaded.sha256,
      url: `http://127.0.0.1:${address.port}/`,
      outputDirectory: join(root, "fail"),
      rootDirectory: root,
    });
    assert.equal(fail.automatedResult, "fail");
    assert.ok(fail.viewports.every((viewport) => viewport.missingCueIds.includes("product-identity")));
  } finally {
    await new Promise<void>((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
    await rm(root, { recursive: true, force: true });
  }
});
