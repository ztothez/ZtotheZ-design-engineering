import { z } from 'zod';
import { DecisionLibrary } from './library.js';
import { DecisionEngine } from './engine.js';
import { DecisionReportSchema } from './schema.js';

export const qualificationFixtureSchema = z.object({
  productId: z.string(),
  taskType: z.string(),
  signals: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  expectedOutcomes: z.record(z.string(), z.enum(['pass', 'fail', 'abstain'])).optional(),
});
export type QualificationFixture = z.infer<typeof qualificationFixtureSchema>;

export const qualificationResultSchema = z.object({
  productId: z.string(),
  taskType: z.string(),
  passed: z.boolean(),
  totalRules: z.number(),
  passedCount: z.number(),
  failedCount: z.number(),
  abstainedCount: z.number(),
  falseClaimCount: z.number(),
  abstentionRate: z.number(),
  report: DecisionReportSchema,
  limitations: z.array(z.string()),
});
export type QualificationResult = z.infer<typeof qualificationResultSchema>;

export class LibraryQualifier {
  private library: DecisionLibrary;
  private engine: DecisionEngine;

  constructor(library: DecisionLibrary) {
    this.library = library;
    this.engine = new DecisionEngine();
  }

  /**
   * Qualify a product against the decision library using a fixture.
   *
   * A qualification passes when:
   * - All selected rules pass with evidence
   * - falseClaimCount === 0 (all outcomes match expectations, if provided)
   */
  public qualifyProduct(fixture: QualificationFixture): QualificationResult {
    const validatedFixture = qualificationFixtureSchema.parse(fixture);

    const rules = this.library.getRulesByTask(validatedFixture.taskType);
    const report = this.engine.evaluate(
      `${validatedFixture.productId}:${validatedFixture.taskType}`,
      rules,
      validatedFixture.signals,
    );

    const passedCount = report.summary.passed;
    const failedCount = report.summary.failed;
    const abstainedCount = report.summary.abstained;
    const totalRules = report.summary.total;

    // Count false claims: outcomes that don't match expectations
    let falseClaimCount = 0;
    const limitations: string[] = [];

    if (validatedFixture.expectedOutcomes) {
      for (const id of Object.keys(validatedFixture.expectedOutcomes)) {
        if (!report.results.some(result => result.ruleId === id)) {
          falseClaimCount++;
          limitations.push(`Expected rule ${id} was not evaluated`);
        }
      }
      for (const result of report.results) {
        const expected = validatedFixture.expectedOutcomes[result.ruleId];
        if (expected !== undefined && result.outcome !== expected) {
          falseClaimCount++;
          limitations.push(
            `Rule ${result.ruleId}: expected ${expected}, got ${result.outcome}`,
          );
        }
      }
    }

    if (failedCount > 0) {
      limitations.push('One or more selected rules failed or lack required evidence');
    }

    const abstentionRate = totalRules > 0 ? abstainedCount / totalRules : 0;

    if (abstentionRate > 0.5) {
      limitations.push(
        `High abstention rate: ${(abstentionRate * 100).toFixed(1)}% of rules had no signal`,
      );
    }

    const passed =
      totalRules > 0 &&
      abstainedCount === 0 &&
      failedCount === 0 &&
      falseClaimCount === 0;

    return qualificationResultSchema.parse({
      productId: validatedFixture.productId,
      taskType: validatedFixture.taskType,
      passed,
      totalRules,
      passedCount,
      failedCount,
      abstainedCount,
      falseClaimCount,
      abstentionRate,
      report,
      limitations,
    });
  }

  /**
   * Qualify multiple products in batch.
   */
  public qualifyAll(fixtures: QualificationFixture[]): QualificationResult[] {
    return fixtures.map(fixture => this.qualifyProduct(fixture));
  }
}
