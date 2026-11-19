import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { extname } from "node:path";

import { parse } from "yaml";

import { productFidelityContractSchema, type ProductFidelityContract } from "./schema.js";
import { resolveProductFidelityInput } from "./policy.js";

export type LoadedProductFidelityContract = {
  contract: ProductFidelityContract;
  sha256: string;
};

export async function loadProductFidelityContract(
  path: string,
  rootDirectory = process.cwd(),
): Promise<LoadedProductFidelityContract> {
  const resolvedPath = await resolveProductFidelityInput(path, rootDirectory);
  if (!/^\.ya?ml$/i.test(extname(resolvedPath))) {
    throw new Error("Product-fidelity contract must be a YAML file");
  }
  const fileStats = await stat(resolvedPath);
  if (!fileStats.isFile()) throw new Error("Product-fidelity contract is not a regular file");
  if (fileStats.size > 256 * 1024) throw new Error("Product-fidelity contract exceeds 256 KiB");
  const source = await readFile(resolvedPath, "utf8");
  return {
    contract: productFidelityContractSchema.parse(parse(source)),
    sha256: createHash("sha256").update(source).digest("hex"),
  };
}
