import { execFile } from "node:child_process";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { evaluateProductFidelity } from "../dist/src/product-fidelity/evaluator.js";
import { loadProductFidelityContract } from "../dist/src/product-fidelity/loader.js";

if (process.argv.length !== 2) {
  throw new Error("Product fidelity capture accepts no paths and runs only repository-owned fixtures.");
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = join(root, ".ztothez-design-runtime");
await mkdir(runtimeRoot, { recursive: true });
if (await realpath(runtimeRoot) !== runtimeRoot) throw new Error("Private runtime root must not be a symlink.");
const output = join(runtimeRoot, `product-fidelity-${new Date().toISOString().replace(/[:.]/g, "-")}`);
await mkdir(output);
const execute = promisify(execFile);
const products = ["aegisops", "scenestart", "azure-optimizer"];
const results = [];

for (const product of products) {
  const fixture = join(root, "tests", "fixtures", "pilots", `${product}-fixture`);
  if (await realpath(fixture) !== fixture || await realpath(join(fixture, "src")) !== join(fixture, "src")) {
    throw new Error(`Fixture path escapes the repository-owned boundary: ${product}.`);
  }
  console.error(`Product fidelity: building ${product}`);
  await execute("npm", ["run", "build"], { cwd: fixture, timeout: 180_000, maxBuffer: 8 * 1024 * 1024 });
  const { preview } = await import(pathToFileURL(join(fixture, "node_modules", "vite", "dist", "node", "index.js")).href);
  const server = await preview({
    root: fixture,
    configFile: join(fixture, "vite.config.ts"),
    logLevel: "silent",
    preview: { host: "127.0.0.1", port: 0, strictPort: false },
  });
  const address = server.httpServer.address();
  if (!address || typeof address === "string") {
    await server.close();
    throw new Error(`Fixture server has no local address: ${product}.`);
  }
  try {
    const loaded = await loadProductFidelityContract(
      join(root, "tests", "fixtures", "product-fidelity", `${product}.yaml`),
    );
    const report = await evaluateProductFidelity({
      contract: loaded.contract,
      contractSha256: loaded.sha256,
      url: `http://127.0.0.1:${address.port}/`,
      outputDirectory: join(output, product),
      rootDirectory: root,
    });
    results.push({
      productId: product,
      contractSha256: loaded.sha256,
      report: `${product}/product-fidelity-report.json`,
      automatedResult: report.automatedResult,
      humanReview: report.humanReview,
    });
  } finally {
    await server.close();
  }
}

const automatedResult = results.every((result) => result.automatedResult === "pass") ? "pass" : "fail";
const aggregate = {
  version: "1.0",
  scope: "repository-owned-product-fidelity",
  generatedAt: new Date().toISOString(),
  authority: "V5",
  cutover: "not-approved",
  automatedResult,
  humanReview: "required",
  results,
  limitations: [
    "Structural fidelity does not prove visual quality or original-product parity.",
    "Reference products were not fetched, executed, or copied by this capture.",
    "No original product or private portfolio source was modified.",
  ],
};
await writeFile(join(output, "product-fidelity-summary.json"), `${JSON.stringify(aggregate, null, 2)}\n`);
console.error(`Product fidelity capture: ${relative(root, output)} (${automatedResult})`);
process.exitCode = automatedResult === "pass" ? 0 : 1;
