import { z } from "zod";

const idSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
const selectorSchema = z.string().min(1).max(512).refine(
  (value) => !/[\0\r\n]/.test(value),
  "Selectors must be single-line CSS selectors.",
);

const fidelityCueSchema = z.object({
  id: idSchema,
  selector: selectorSchema,
  purpose: z.string().min(8).max(300),
  minimumVisible: z.number().int().min(1).max(20).default(1),
  maximumVisible: z.number().int().min(1).max(20).default(1),
}).strict().superRefine((cue, context) => {
  if (cue.maximumVisible < cue.minimumVisible) {
    context.addIssue({
      code: "custom",
      path: ["maximumVisible"],
      message: "maximumVisible must be greater than or equal to minimumVisible.",
    });
  }
});

export const productFidelityContractSchema = z.object({
  version: z.literal("1.0"),
  productId: idSchema,
  scope: z.literal("repository-owned-product-fidelity"),
  route: z.string().regex(/^\/(?:[a-z0-9/_-]*)$/i).max(256),
  reference: z.object({
    kind: z.literal("owner-controlled-public-product"),
    url: z.url().refine((value) => value.startsWith("https://"), "Reference URL must use HTTPS."),
    observedAt: z.string().date(),
    evidenceBoundary: z.string().min(20).max(600),
  }).strict(),
  requiredCues: z.array(fidelityCueSchema).min(4).max(20),
  documentOrder: z.array(idSchema).min(2).max(20),
  requiredViewports: z.array(z.object({
    id: idSchema,
    width: z.number().int().min(240).max(3_840),
    height: z.number().int().min(240).max(2_160),
  }).strict()).min(2).max(8),
  humanReview: z.object({
    required: z.literal(true),
    categories: z.array(z.enum([
      "brand-fit",
      "information-hierarchy",
      "visual-rhythm",
      "domain-fit",
      "responsive-composition",
    ])).min(3).max(5),
  }).strict(),
}).strict().superRefine((contract, context) => {
  const cueIds = contract.requiredCues.map((cue) => cue.id);
  if (new Set(cueIds).size !== cueIds.length) {
    context.addIssue({ code: "custom", path: ["requiredCues"], message: "Cue IDs must be unique." });
  }
  if (new Set(contract.documentOrder).size !== contract.documentOrder.length) {
    context.addIssue({ code: "custom", path: ["documentOrder"], message: "Document-order cue IDs must be unique." });
  }
  for (const [index, cueId] of contract.documentOrder.entries()) {
    if (!cueIds.includes(cueId)) {
      context.addIssue({
        code: "custom",
        path: ["documentOrder", index],
        message: `Unknown cue ID: ${cueId}.`,
      });
    }
  }
  const viewportIds = contract.requiredViewports.map((viewport) => viewport.id);
  if (new Set(viewportIds).size !== viewportIds.length) {
    context.addIssue({ code: "custom", path: ["requiredViewports"], message: "Viewport IDs must be unique." });
  }
  if (new Set(contract.humanReview.categories).size !== contract.humanReview.categories.length) {
    context.addIssue({ code: "custom", path: ["humanReview", "categories"], message: "Review categories must be unique." });
  }
});

export const productFidelityReportSchema = z.object({
  version: z.literal("1.0"),
  productId: idSchema,
  generatedAt: z.string().datetime(),
  url: z.url(),
  contractSha256: z.string().regex(/^[a-f0-9]{64}$/),
  browser: z.string().min(1),
  viewports: z.array(z.object({
    id: idSchema,
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    cueCounts: z.record(idSchema, z.number().int().nonnegative()),
    missingCueIds: z.array(idSchema),
    duplicateCueIds: z.array(idSchema),
    documentOrderPassed: z.boolean(),
    overflow: z.boolean(),
    passed: z.boolean(),
  }).strict()).min(2),
  automatedResult: z.enum(["pass", "fail"]),
  humanReview: z.literal("required"),
  supportedClaims: z.array(z.string()),
  limitations: z.array(z.string()).min(1),
}).strict();

export type ProductFidelityContract = z.infer<typeof productFidelityContractSchema>;
export type ProductFidelityReport = z.infer<typeof productFidelityReportSchema>;
