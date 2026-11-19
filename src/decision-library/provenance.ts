import { createHash } from "node:crypto";
import { z } from "zod";

export const provenanceSchema = z.object({
  version: z.literal("1.0"),
  method: z.literal("policy-reconciliation"),
  reviewerClass: z.literal("ai-assisted"),
  authority: z.literal("project-policy"),
  rationale: z.string().min(20),
  sources: z.array(z.object({
    path: z.string().refine(value => /^(SKILL\.md|knowledge-base\/[a-zA-Z0-9/_.-]+)$/.test(value)
      && !value.split("/").includes("..")),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict()).min(1),
  ruleSha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export function canonical(value: unknown): string {
  const ordered = (input: unknown): unknown => Array.isArray(input) ? input.map(ordered)
    : input && typeof input === "object" ? Object.fromEntries(Object.entries(input)
      .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, ordered(item)])) : input;
  return JSON.stringify(ordered(value));
}

export function ruleFingerprint(rule: object): string {
  const { provenance: _provenance, ...body } = rule as Record<string, unknown>;
  return createHash("sha256").update(canonical(body)).digest("hex");
}
