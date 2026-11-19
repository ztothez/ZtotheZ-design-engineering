import { z } from "zod";

const measurementSchema = z.object({
  version: z.literal("1.0"),
  kind: z.enum(["normal-text-contrast", "effective-target-size"]),
  minimum: z.number().finite().nonnegative().nullable(),
  measuredCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
}).strict().refine(value => (value.measuredCount === 0) === (value.minimum === null), "Measurement count and minimum disagree");

const runtimeReportSchema = z.object({
  passed: z.boolean(),
  viewports: z.array(z.object({ name: z.string().optional(), width: z.number().positive() }).passthrough()).min(1),
  colorSchemes: z.array(z.enum(["light", "dark"])).optional(),
  findings: z.array(z.object({
    checkId: z.string(), viewport: z.string().optional(), journey: z.string().optional(),
    measurement: measurementSchema.optional(),
  }).passthrough()).optional(),
  summary: z.object({ errors: z.number().int().nonnegative() }).passthrough(),
  decisionSignals: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
}).passthrough();

export const runtimeSignalEvidenceSchema = z.object({
  signals: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  evidencePaths: z.array(z.string().min(1)),
  supportedCategories: z.array(z.string().min(1)),
  supportedRuleIds: z.array(z.string().min(1)),
  unsupportedCategories: z.array(z.string().min(1)),
  limitations: z.array(z.string().min(1)),
}).strict();

export type RuntimeSignalEvidence = z.infer<typeof runtimeSignalEvidenceSchema>;

/**
 * Converts only directly observable runtime facts into decision signals.
 * A report does not prove categories that it did not explicitly measure.
 */
export function extractRuntimeSignals(
  report: unknown,
  evidencePath: string,
  profile: string,
): RuntimeSignalEvidence {
  const parsed = runtimeReportSchema.parse(report);
  const unsupportedCategories = [
    "accessibility",
    "state",
    "tokens",
    "hierarchy",
    "truthful-disclosure",
    "maintainability",
  ];

  const breakpointCount = new Set(parsed.viewports.map((viewport) => viewport.width)).size;
  const minimumWidth = Math.min(...parsed.viewports.map((viewport) => viewport.width));

  const signals: Record<string, number> = {};
  const limitations: string[] = [];
  const responsive = profile === "responsive-overview" || breakpointCount >= 3;
  if (responsive) {
    signals["ZTDE-LIB-RESP-002"] = breakpointCount;
    if (minimumWidth <= 320 && parsed.passed && parsed.summary.errors === 0) signals["ZTDE-LIB-RESP-001"] = minimumWidth;
  } else {
    limitations.push(`Profile ${profile} does not directly establish the responsive signal.`);
  }

  for (const [kind, checkId, ruleId, threshold] of [
    ["normal-text-contrast", "ZTDE-RUNTIME-011-MEASURED", "ZTDE-LIB-A11Y-001", 4.5],
    ["effective-target-size", "ZTDE-RUNTIME-012-MEASURED", "ZTDE-LIB-A11Y-002", 44],
  ] as const) {
    const records = (parsed.findings ?? []).filter(item => item.checkId === checkId && item.measurement?.kind === kind);
    const samples = records.flatMap(item => item.measurement?.minimum === null ? [] : [item.measurement!.minimum!]);
    const schemes = parsed.colorSchemes ?? ["light"];
    const complete = parsed.viewports.every(viewport => viewport.name && schemes.every(scheme => records.some(item => !item.journey
      && item.viewport === (schemes.length === 1 && scheme === "light" ? viewport.name : `${viewport.name}-${scheme}`)
      ))) && records.every(item => item.measurement!.skippedCount === 0);
    // A measured counterexample establishes failure even when other samples remain unavailable.
    if (samples.length && (Math.min(...samples) < threshold || complete)) signals[ruleId] = Math.min(...samples);
    if (!complete) limitations.push(`${ruleId}: sample coverage is incomplete; absent samples or exclusions cannot establish a pass.`);
  }

  return runtimeSignalEvidenceSchema.parse({
    signals,
    evidencePaths: [evidencePath],
    supportedCategories: [...(responsive ? ["responsive"] : []), ...(Object.keys(signals).some(id => id.includes("A11Y")) ? ["accessibility"] : [])],
    supportedRuleIds: Object.keys(signals),
    unsupportedCategories: [...(responsive ? [] : ["responsive"]), ...unsupportedCategories],
    limitations: [
      "This adapter establishes reported breakpoint coverage and versioned normal-text/target measurements only.",
      "Accessibility remains partially unsupported: these samples do not certify assistive technology, keyboard behavior, all states, or every text/background type.",
      ...limitations,
      ...(Object.keys(parsed.decisionSignals ?? {}).length > 0
        ? ["Legacy decisionSignals lack measurement provenance and are not qualification evidence."]
        : []),
    ],
  });
}
