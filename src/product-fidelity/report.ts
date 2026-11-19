import type { ProductFidelityReport } from "./schema.js";

export function formatProductFidelityReport(report: ProductFidelityReport): string {
  const lines = [
    "# ZtotheZ Product Fidelity Verification",
    "",
    `- Product: ${report.productId}`,
    `- Automated result: ${report.automatedResult.toUpperCase()}`,
    `- Human review: ${report.humanReview}`,
    `- Contract SHA-256: \`${report.contractSha256}\``,
    "",
    "## Viewports",
    "",
    ...report.viewports.map((viewport) =>
      `- ${viewport.id} (${viewport.width}x${viewport.height}): ${viewport.passed ? "PASS" : "FAIL"}; missing=${viewport.missingCueIds.join(", ") || "none"}; duplicates=${viewport.duplicateCueIds.join(", ") || "none"}; order=${viewport.documentOrderPassed ? "pass" : "fail"}; overflow=${viewport.overflow}`,
    ),
    "",
    "## Evidence Boundary",
    "",
    ...report.limitations.map((limitation) => `- ${limitation}`),
  ];
  return lines.join("\n");
}
