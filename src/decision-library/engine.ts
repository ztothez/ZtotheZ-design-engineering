import { DecisionReporter } from './report.js';
import type { DecisionReport, DecisionResult, DecisionOutcome, DesignRule } from './schema.js';

/**
 * V7 Decision Engine.
 *
 * Evaluates design rules against provided signals, producing three-state
 * outcomes (pass / fail / abstain). Priority orders review; it cannot change
 * the measured outcome of another rule in the same category.
 */
export class DecisionEngine {
  constructor() {}

  /**
   * Evaluate a set of rules against the provided signals for a given target.
   */
  public evaluate(
    target: string,
    rules: DesignRule[],
    signals: Record<string, string | number | boolean>,
  ): DecisionReport {
    const rawResults: DecisionResult[] = [];

    for (const rule of rules) {
      const result = this.evaluateRule(rule, signals);
      rawResults.push(result);
    }

    const reporter = new DecisionReporter(target);
    // Only explicitly declared policy conflicts may block adoption. Never overwrite measurements.
    const passing = new Set(rawResults.filter(item => item.outcome === 'pass').map(item => item.ruleId));
    const conflicted = new Set<string>();
    for (const rule of rules) {
      for (const id of rule.conflictsWith ?? []) {
        if (passing.has(rule.id) && passing.has(id)) { conflicted.add(rule.id); conflicted.add(id); }
      }
    }
    for (const rule of rules) {
      const result = rawResults.find(item => item.ruleId === rule.id)!;
      if (conflicted.has(rule.id)) {
        result.outcome = 'abstain';
        result.reason = 'Conflicting applicable policies require an explicit scoped decision';
      }
    }
    reporter.addResults(rawResults.sort((a, b) =>
      b.conflictPriority - a.conflictPriority || a.ruleId.localeCompare(b.ruleId),
    ));
    return reporter.generateReport();
  }

  /**
   * Evaluate a single rule against signals.
   */
  private evaluateRule(
    rule: DesignRule,
    signals: Record<string, string | number | boolean>,
  ): DecisionResult {
    // Prefer a rule-specific measurement when one exists. Category-level signals
    // remain supported for simple boolean and qualitative checks.
    const signalKey = signals[rule.id] !== undefined ? rule.id : rule.category;
    const signal = signals[signalKey];
    const requiredEvidence = `${rule.evidenceClass}:${rule.verificationMethod}`;

    // --- No signal present ---
    if (signal === undefined) {
      return this.handleMissingSignal(rule, requiredEvidence);
    }

    // --- Signal is present ---
    let outcome: DecisionOutcome;
    let reason: string;

    if (rule.threshold.type === 'quantitative') {
      const measurement = typeof signal === 'number' ? signal
        : typeof signal === 'string' && signal.trim() !== '' ? Number(signal) : NaN;
      const limit = rule.threshold.value.trim() === '' ? NaN : Number(rule.threshold.value);
      const comparison = rule.threshold.comparison ?? 'at-least';
      const minimum = rule.threshold.minimum;
      const valid = Number.isFinite(measurement) && Number.isFinite(limit)
        && (minimum === undefined || Number.isFinite(minimum));
      const meetsLimit = comparison === 'at-most' ? measurement <= limit : measurement >= limit;
      outcome = valid && meetsLimit && (minimum === undefined || measurement >= minimum) ? 'pass' : 'fail';
      reason = !valid ? 'A quantitative threshold requires a finite numeric measurement and limits'
        : `Measurement ${measurement}; required ${comparison} ${limit}${minimum === undefined ? '' : ` and at-least ${minimum}`}`;
    } else if (typeof signal === 'boolean') {
      outcome = signal ? 'pass' : 'fail';
      reason = signal
        ? 'Boolean signal indicates condition met'
        : 'Boolean signal indicates condition violated';
    } else if (typeof signal === 'number') {
      outcome = 'fail';
      reason = 'Numeric signal provided but threshold type is qualitative';
    } else {
      outcome = signal === rule.threshold.value ? 'pass' : 'fail';
      reason = outcome === 'pass'
        ? `String signal matches threshold value "${rule.threshold.value}"`
        : `String signal "${signal}" does not match threshold "${rule.threshold.value}"`;
    }

    return {
      ruleId: rule.id,
      outcome,
      reason,
      requiredEvidence,
      verificationMethod: rule.verificationMethod,
      conflictPriority: rule.conflictPriority,
      confidence: rule.confidence,
      ...(rule.provenance ? { provenanceFingerprint: rule.provenance.ruleSha256 } : {}),
    };
  }

  /**
   * Handle the case when no signal is available for a rule's category.
   */
  private handleMissingSignal(
    rule: DesignRule,
    requiredEvidence: string,
  ): DecisionResult {
    let outcome: DecisionOutcome;
    let reason: string;

    switch (rule.abstentionBehavior) {
      case 'fail-closed':
        outcome = 'fail';
        reason = 'Missing required evidence (fail-closed)';
        break;
      case 'abstain-if-no-signal':
        outcome = 'abstain';
        reason = 'No signal available for evaluation';
        break;
    }

    return {
      ruleId: rule.id,
      outcome,
      reason,
      requiredEvidence,
      verificationMethod: rule.verificationMethod,
      conflictPriority: rule.conflictPriority,
      confidence: rule.confidence,
      ...(rule.provenance ? { provenanceFingerprint: rule.provenance.ruleSha256 } : {}),
    };
  }

}
