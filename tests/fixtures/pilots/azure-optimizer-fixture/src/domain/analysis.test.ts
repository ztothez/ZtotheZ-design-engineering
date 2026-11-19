import { describe, expect, it } from 'vitest';
import { analyzeDemonstration } from './analysis.js';

describe('local analysis', () => {
  it('ranks disclosed synthetic findings and derives the savings total', () => {
    const report = analyzeDemonstration('demo');
    expect(report.monthlySavings).toBe(1240);
    expect(report.findings.map(finding => finding.resource)).toEqual(['vm-prod-17', 'disk-demo-04', 'vm-dev-03']);
    expect(report.findings.every(finding => finding.validation.length > 0)).toBe(true);
    report.findings[0]!.monthlySavings = 0;
    expect(analyzeDemonstration('demo').monthlySavings).toBe(1240);
  });
  it('never substitutes demonstration results for unavailable sources', () => {
    for (const mode of ['live', 'imported', 'cached', 'unknown']) expect(() => analyzeDemonstration(mode)).toThrow();
  });
});
