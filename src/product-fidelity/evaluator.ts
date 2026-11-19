import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { chromium } from "playwright-core";

import { resolveChromiumPath, validateRuntimeUrl } from "../runtime/policy.js";
import {
  productFidelityReportSchema,
  type ProductFidelityContract,
  type ProductFidelityReport,
} from "./schema.js";
import { requireLoopbackProductFidelityUrl, resolveProductFidelityOutput } from "./policy.js";

export async function evaluateProductFidelity(options: {
  contract: ProductFidelityContract;
  contractSha256: string;
  url: string;
  outputDirectory: string;
  chromiumPath?: string;
  rootDirectory?: string;
}): Promise<ProductFidelityReport> {
  const base = requireLoopbackProductFidelityUrl(validateRuntimeUrl(options.url).toString());
  const target = requireLoopbackProductFidelityUrl(
    validateRuntimeUrl(new URL(options.contract.route, base).toString()).toString(),
  );
  const outputDirectory = await resolveProductFidelityOutput(
    options.outputDirectory,
    options.rootDirectory,
  );
  const browser = await chromium.launch({
    headless: true,
    executablePath: resolveChromiumPath(options.chromiumPath),
    args: ["--disable-dev-shm-usage", "--no-sandbox"],
  });
  const browserVersion = browser.version();
  const viewports: ProductFidelityReport["viewports"] = [];
  try {
    for (const viewport of options.contract.requiredViewports) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      try {
        await page.goto(target.toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
        await page.waitForTimeout(100);
        const observed = await page.evaluate(({ cues, order }) => {
          const visible = (element: Element): boolean => {
            const rectangle = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rectangle.width > 1 && rectangle.height > 1 && style.display !== "none" &&
              style.visibility !== "hidden" && Number.parseFloat(style.opacity || "1") > 0.01;
          };
          const cueCounts: Record<string, number> = {};
          const cueElements: Record<string, Element | undefined> = {};
          for (const cue of cues) {
            const elements = [...document.querySelectorAll(cue.selector)].filter(visible);
            cueCounts[cue.id] = elements.length;
            cueElements[cue.id] = elements[0];
          }
          let documentOrderPassed = true;
          for (let index = 1; index < order.length; index += 1) {
            const previous = cueElements[order[index - 1]!];
            const current = cueElements[order[index]!];
            if (!previous || !current || !(previous.compareDocumentPosition(current) & Node.DOCUMENT_POSITION_FOLLOWING)) {
              documentOrderPassed = false;
              break;
            }
          }
          return {
            cueCounts,
            documentOrderPassed,
            overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          };
        }, { cues: options.contract.requiredCues, order: options.contract.documentOrder });
        const missingCueIds = options.contract.requiredCues
          .filter((cue) => (observed.cueCounts[cue.id] ?? 0) < cue.minimumVisible)
          .map((cue) => cue.id);
        const duplicateCueIds = options.contract.requiredCues
          .filter((cue) => (observed.cueCounts[cue.id] ?? 0) > cue.maximumVisible)
          .map((cue) => cue.id);
        const passed = missingCueIds.length === 0 && duplicateCueIds.length === 0 &&
          observed.documentOrderPassed && !observed.overflow;
        viewports.push({ ...viewport, ...observed, missingCueIds, duplicateCueIds, passed });
        await page.screenshot({ path: join(outputDirectory, `${viewport.id}.png`), fullPage: true, animations: "disabled" });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  const automatedResult = viewports.every((viewport) => viewport.passed) ? "pass" : "fail";
  const report = productFidelityReportSchema.parse({
    version: "1.0",
    productId: options.contract.productId,
    generatedAt: new Date().toISOString(),
    url: target.toString(),
    contractSha256: options.contractSha256,
    browser: `Chromium ${browserVersion}`,
    viewports,
    automatedResult,
    humanReview: "required",
    supportedClaims: automatedResult === "pass" ? [
      "The declared product identity and information-architecture cues were visible in the required order at every configured viewport.",
      "No horizontal document overflow was observed at the configured viewports.",
    ] : [],
    limitations: [
      "Automated cue checks do not prove visual quality, brand preference, usability, or pixel parity with the reference product.",
      "The reference URL identifies an owner-controlled comparison target; this command does not fetch, copy, or execute that target.",
      "Attributable human review remains required for brand fit, hierarchy, rhythm, domain fit, and responsive composition.",
    ],
  });
  await writeFile(join(outputDirectory, "product-fidelity-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}
