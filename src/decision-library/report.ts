import { DecisionReport, DecisionResult, DecisionReportSchema } from './schema.js';
import * as crypto from 'node:crypto';

export class DecisionReporter {
  private target: string;
  private results: DecisionResult[] = [];

  constructor(target: string) {
    this.target = target;
  }

  public addResult(result: DecisionResult): void {
    this.results.push(result);
  }

  public addResults(results: DecisionResult[]): void {
    this.results.push(...results);
  }

  public generateReport(): DecisionReport {
    const total = this.results.length;
    const passed = this.results.filter(r => r.outcome === 'pass').length;
    const failed = this.results.filter(r => r.outcome === 'fail').length;
    const abstained = this.results.filter(r => r.outcome === 'abstain').length;

    const report: DecisionReport = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      target: this.target,
      evidenceScope: 'supplied-signals-not-independent-verification',
      summary: {
        total,
        passed,
        failed,
        abstained,
      },
      results: this.results,
    };

    return DecisionReportSchema.parse(report);
  }
}
