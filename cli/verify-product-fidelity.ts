#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateProductFidelity } from "../src/product-fidelity/evaluator.js";
import { loadProductFidelityContract } from "../src/product-fidelity/loader.js";
import { formatProductFidelityReport } from "../src/product-fidelity/report.js";

function usage(): string {
  return "Usage: zz-design verify-product-fidelity --contract PATH --url LOOPBACK_URL --output PATH [--json]";
}

export async function runVerifyProductFidelityCli(argumentsList: string[]): Promise<number> {
  let contractPath = "";
  let url = "";
  let outputDirectory = "";
  let json = false;
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    const next = argumentsList[index + 1];
    if (argument === "--contract" && next) { contractPath = resolve(next); index += 1; }
    else if (argument === "--url" && next) { url = next; index += 1; }
    else if (argument === "--output" && next) { outputDirectory = resolve(next); index += 1; }
    else if (argument === "--json") json = true;
    else if (argument === "--help" || argument === "-h") { process.stdout.write(`${usage()}\n`); return 0; }
    else throw new Error(`Unknown or incomplete argument: ${argument}`);
  }
  if (!contractPath || !url || !outputDirectory) throw new Error("--contract, --url, and --output are required");
  const loaded = await loadProductFidelityContract(contractPath);
  const report = await evaluateProductFidelity({
    contract: loaded.contract,
    contractSha256: loaded.sha256,
    url,
    outputDirectory,
    rootDirectory: process.cwd(),
  });
  process.stdout.write(`${json ? JSON.stringify(report, null, 2) : formatProductFidelityReport(report)}\n`);
  return report.automatedResult === "pass" ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runVerifyProductFidelityCli(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch((error: unknown) => {
    process.stderr.write(`Product fidelity verification failed: ${error instanceof Error ? error.message : String(error)}\n${usage()}\n`);
    process.exitCode = 1;
  });
}
