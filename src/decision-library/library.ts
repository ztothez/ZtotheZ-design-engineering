import { DesignRule, DesignRuleSchema } from './schema.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import { ruleFingerprint } from './provenance.js';

export class DecisionLibrary {
  private rules: Map<string, DesignRule> = new Map();

  constructor() {}

  /**
   * Load rules from a JSON file.
   * Validates the file contents against the DesignRule schema.
   */
  public loadFromFile(filePath: string): void {
    const resolvedPath = path.resolve(filePath);
    const stats = fs.statSync(resolvedPath);
    if (!stats.isFile() || stats.size > 4 * 1024 * 1024) throw new Error('Decision library must be a bounded regular file');
    const content = fs.readFileSync(resolvedPath, 'utf8');
    const parsed = JSON.parse(content);
    const validatedRules = z.array(DesignRuleSchema).parse(parsed);
    const ids = new Set(this.rules.keys());
    for (const rule of validatedRules) {
      if (ids.has(rule.id)) throw new Error('Duplicate decision rule identity');
      ids.add(rule.id);
    }

    for (const rule of validatedRules) {
      this.addRule(rule);
    }
  }

  /**
   * Load rules from a repository's model/decision-library.json file.
   * Safely resolves the path and prevents directory traversal outside the project root.
   */
  public loadFromRepository(projectRoot: string): void {
    const resolvedRoot = fs.realpathSync(projectRoot);
    const targetPath = fs.realpathSync(
      path.join(resolvedRoot, 'model', 'decision-library.json'),
    );

    // Prevent path traversal — resolved target must be within the project root
    if (!targetPath.startsWith(resolvedRoot + path.sep) && targetPath !== resolvedRoot) {
      throw new Error(
        `Path traversal detected: resolved path escapes repository root`,
      );
    }

    const candidate = new DecisionLibrary();
    candidate.loadFromFile(targetPath);
    for (const rule of candidate.getAllRules()) {
      if (!rule.id.startsWith('ZTDE-LIB-') || !rule.provenance
        || rule.provenance.ruleSha256 !== ruleFingerprint(rule)) {
        throw new Error('Maintained decision rule has invalid identity or provenance fingerprint');
      }
      for (const conflict of rule.conflictsWith ?? []) {
        if (conflict === rule.id || !candidate.getRule(conflict)) throw new Error('Invalid decision conflict reference');
      }
    }
    this.rules = new Map(candidate.getAllRules().map(rule => [rule.id, rule]));
  }

  /**
   * Add a single rule to the library.
   * Rejects duplicate identities rather than silently replacing another rule.
   */
  public addRule(rule: DesignRule): void {
    const validated = DesignRuleSchema.parse(rule);
    if (this.rules.has(validated.id)) throw new Error('Duplicate decision rule identity');
    this.rules.set(validated.id, validated);
  }

  /**
   * Retrieve a rule by its ID.
   */
  public getRule(id: string): DesignRule | undefined {
    return this.rules.get(id);
  }

  /**
   * Get all loaded rules.
   */
  public getAllRules(): DesignRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get rules filtered by category.
   */
  public getRulesByCategory(category: string): DesignRule[] {
    return this.getAllRules().filter(rule => rule.category === category);
  }

  /**
   * Get rules applicable to a specific task type.
   * Matches rules whose taskApplicability includes the given type or ["*"].
   */
  public getRulesByTask(taskType: string): DesignRule[] {
    return this.getAllRules().filter(
      rule =>
        rule.taskApplicability.includes('*') ||
        rule.taskApplicability.includes(taskType),
    );
  }

  /**
   * Get rules applicable to a specific platform.
   * Matches rules whose platformApplicability includes the given platform or ["*"].
   */
  public getRulesByPlatform(platform: string): DesignRule[] {
    return this.getAllRules().filter(
      rule =>
        rule.platformApplicability.includes('*') ||
        rule.platformApplicability.includes(platform),
    );
  }

  /**
   * Clear all loaded rules.
   */
  public clear(): void {
    this.rules.clear();
  }
}
