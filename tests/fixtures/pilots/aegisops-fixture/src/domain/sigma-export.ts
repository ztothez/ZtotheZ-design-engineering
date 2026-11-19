export function createSyntheticSigma(technique: string) {
  if (!/^T\d{4}(?:\.\d{3})?$/.test(technique)) throw new Error("A valid technique identifier is required");
  return {
    filename: `sigma_${technique}.yml`,
    body: [
      `title: Synthetic fixture example for ${technique}`,
      "status: experimental",
      "description: Non-deployable demonstration data. No production telemetry or detection validation is claimed.",
      "logsource:",
      "  product: ztde_fixture",
      "detection:",
      "  selection:",
      `    fixture_technique: ${technique}`,
      "    fixture_demo: true",
      "  condition: selection",
      "level: informational",
      "",
    ].join("\n"),
  };
}
