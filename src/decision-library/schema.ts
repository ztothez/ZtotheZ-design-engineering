import { z } from 'zod';
import { provenanceSchema } from './provenance.js';

// --- Design Rule Schema ---

export const ThresholdSchema = z.object({
  type: z.enum(['quantitative', 'qualitative']),
  value: z.string(),
  unit: z.string().optional(),
  comparison: z.enum(['at-least', 'at-most']).optional(),
  minimum: z.number().finite().optional(),
});
export type Threshold = z.infer<typeof ThresholdSchema>;

export const ConfidenceSchema = z.enum(['high', 'medium', 'low']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const EvidenceClassSchema = z.enum([
  'measured',
  'observed',
  'heuristic',
  'expert-opinion',
]);
export type EvidenceClass = z.infer<typeof EvidenceClassSchema>;

export const VerificationMethodSchema = z.enum([
  'automated',
  'manual-inspection',
  'tool-assisted',
  'review',
]);
export type VerificationMethod = z.infer<typeof VerificationMethodSchema>;

export const AbstentionBehaviorSchema = z.enum([
  'abstain-if-no-signal',
  'fail-closed',
]);
export type AbstentionBehavior = z.infer<typeof AbstentionBehaviorSchema>;

export const ComplianceLevelSchema = z.enum([
  'mandatory',
  'recommended',
  'optional',
]);
export type ComplianceLevel = z.infer<typeof ComplianceLevelSchema>;

export const DesignRuleSchema = z.object({
  id: z.string().min(1).regex(/^ZTDE-/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  title: z.string().min(1),
  taskApplicability: z.array(z.string()).min(1),
  productApplicability: z.array(z.string()),
  platformApplicability: z.array(z.string()),
  statement: z.string().min(10),
  threshold: ThresholdSchema,
  failureCondition: z.string().min(5),
  counterexample: z.string().min(5),
  confidence: ConfidenceSchema,
  evidenceClass: EvidenceClassSchema,
  verificationMethod: VerificationMethodSchema,
  conflictPriority: z.number().int().min(1).max(100),
  exceptionPolicy: z.string().default('none'),
  abstentionBehavior: AbstentionBehaviorSchema,
  level: ComplianceLevelSchema,
  category: z.string().min(1),
  provenance: provenanceSchema.optional(),
  conflictsWith: z.array(z.string().regex(/^ZTDE-/)).optional(),
});
export type DesignRule = z.infer<typeof DesignRuleSchema>;

// --- Decision Outcome ---

export const DecisionOutcomeSchema = z.enum(['pass', 'fail', 'abstain']);
export type DecisionOutcome = z.infer<typeof DecisionOutcomeSchema>;

// --- Decision Result ---

export const DecisionResultSchema = z.object({
  ruleId: z.string(),
  outcome: DecisionOutcomeSchema,
  reason: z.string(),
  requiredEvidence: z.string(),
  verificationMethod: z.string(),
  conflictPriority: z.number(),
  confidence: ConfidenceSchema,
  provenanceFingerprint: z.string().optional(),
});
export type DecisionResult = z.infer<typeof DecisionResultSchema>;

// --- Decision Report ---

export const DecisionReportSchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  target: z.string(),
  evidenceScope: z.literal('supplied-signals-not-independent-verification'),
  summary: z.object({
    total: z.number().int().nonnegative(),
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    abstained: z.number().int().nonnegative(),
  }),
  results: z.array(DecisionResultSchema),
});
export type DecisionReport = z.infer<typeof DecisionReportSchema>;
