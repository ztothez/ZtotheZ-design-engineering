import { mkdir, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

function isContained(root: string, candidate: string): boolean {
  const relation = relative(root, candidate);
  return relation === "" || (!relation.startsWith(`..${sep}`) && relation !== ".." && !isAbsolute(relation));
}

export async function resolveProductFidelityInput(
  requestedPath: string,
  rootDirectory = process.cwd(),
): Promise<string> {
  if (requestedPath.includes("\0")) throw new Error("Product-fidelity contract path contains a null byte");
  const root = await realpath(resolve(rootDirectory));
  const candidate = isAbsolute(requestedPath) ? resolve(requestedPath) : resolve(root, requestedPath);
  if (!isContained(root, candidate)) throw new Error("Product-fidelity contract escapes the allowed root");
  const canonical = await realpath(candidate);
  if (!isContained(root, canonical)) throw new Error("Product-fidelity contract resolves outside the allowed root");
  return canonical;
}

export async function resolveProductFidelityOutput(
  requestedPath: string,
  rootDirectory = process.cwd(),
): Promise<string> {
  if (requestedPath.includes("\0")) throw new Error("Product-fidelity output path contains a null byte");
  const root = await realpath(resolve(rootDirectory));
  const candidate = isAbsolute(requestedPath) ? resolve(requestedPath) : resolve(root, requestedPath);
  if (!isContained(root, candidate)) throw new Error("Product-fidelity output escapes the allowed root");

  let existingAncestor = candidate;
  while (true) {
    try {
      const canonicalAncestor = await realpath(existingAncestor);
      if (!isContained(root, canonicalAncestor)) {
        throw new Error("Product-fidelity output resolves outside the allowed root");
      }
      break;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
      const parent = dirname(existingAncestor);
      if (parent === existingAncestor) throw error;
      existingAncestor = parent;
    }
  }

  await mkdir(candidate, { recursive: true });
  const canonical = await realpath(candidate);
  if (!isContained(root, canonical)) throw new Error("Product-fidelity output resolves outside the allowed root");
  return canonical;
}

export function requireLoopbackProductFidelityUrl(value: string): URL {
  const url = new URL(value);
  if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
    throw new Error("Product-fidelity verification accepts only loopback runtime URLs");
  }
  return url;
}
