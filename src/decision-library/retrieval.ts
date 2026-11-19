import { DecisionLibrary } from './library.js';
import { DesignRuleSchema, type DesignRule } from './schema.js';
import { z } from 'zod';
import { tokenizeForRetrieval } from '../retrieval/search.js';

export const decisionQuerySchema = z.object({
  query: z.string().trim().max(1000).default(''),
  task: z.string().trim().min(1).max(128).optional(),
  platform: z.string().trim().min(1).max(128).optional(),
  product: z.string().trim().min(1).max(128).optional(),
  limit: z.number().int().min(1).max(100).default(10),
}).strict();

export const decisionSearchSchema = z.object({
  status: z.enum(['matched', 'no-match']),
  authority: z.literal('shadow'),
  confidenceMeaning: z.literal('lexical-relevance-not-evidence-or-probability'),
  results: z.array(z.object({
    rule: DesignRuleSchema,
    score: z.number(),
    matchedTerms: z.array(z.string()),
    confidence: z.enum(['high', 'medium', 'low']),
    sourcePath: z.literal('model/decision-library.json'),
  }).strict()),
}).strict();

export class RuleRetriever {
  constructor(private library: DecisionLibrary) {}

  public search(input: z.input<typeof decisionQuerySchema>): z.infer<typeof decisionSearchSchema> {
    const request = decisionQuerySchema.parse(input);
    const terms = [...new Set(tokenizeForRetrieval(request.query))];
    const applicable = (values: string[], value?: string) => !value || values.includes('*') || values.includes(value);
    const exactIdentifier = /^ZTDE-LIB-[A-Z0-9]+-[0-9]{3}$/.test(request.query.toUpperCase());
    const scoped = this.library.getAllRules().filter(rule => (!exactIdentifier || rule.id === request.query.toUpperCase())
      && applicable(rule.taskApplicability, request.task)
      && applicable(rule.platformApplicability, request.platform) && applicable(rule.productApplicability, request.product));
    const documents = scoped.map(rule => ({ rule,
      title: tokenizeForRetrieval(`${rule.title} ${rule.category}`),
      words: tokenizeForRetrieval(`${rule.title} ${rule.category} ${rule.statement} ${rule.taskApplicability.join(' ')}`),
    }));
    const average = documents.reduce((sum, doc) => sum + doc.words.length, 0) / Math.max(1, documents.length);
    const results = documents.map(doc => {
      const matchedTerms = exactIdentifier ? terms : terms.filter(term => doc.words.includes(term));
      let score = 0;
      for (const term of matchedTerms) {
        const frequency = doc.words.filter(word => word === term).length;
        const documentFrequency = documents.filter(other => other.words.includes(term)).length;
        const idf = Math.log(1 + (documents.length - documentFrequency + 0.5) / (documentFrequency + 0.5));
        score += idf * frequency * 2.2 / (frequency + 1.2 * (0.25 + 0.75 * doc.words.length / Math.max(1, average)));
        if (doc.title.includes(term)) score += idf;
      }
      return { rule: doc.rule, score: Number(score.toFixed(8)), matchedTerms,
        confidence: terms.length > 0 && matchedTerms.length === terms.length ? 'high' as const
          : matchedTerms.length / Math.max(1, terms.length) >= 0.5 ? 'medium' as const : 'low' as const,
        sourcePath: 'model/decision-library.json' as const };
    }).filter(item => terms.length ? item.matchedTerms.length / terms.length >= 0.5
      : request.query === '' && !!(request.task || request.platform || request.product))
      .sort((a, b) => b.score - a.score || b.rule.conflictPriority - a.rule.conflictPriority || a.rule.id.localeCompare(b.rule.id))
      .slice(0, request.limit);
    return decisionSearchSchema.parse({ status: results.length ? 'matched' : 'no-match', authority: 'shadow',
      confidenceMeaning: 'lexical-relevance-not-evidence-or-probability', results });
  }

  /**
   * Basic search using keywords in title or statement.
   */
  public searchByKeyword(keyword: string): DesignRule[] {
    return this.search({ query: keyword, limit: 100 }).results.map(result => result.rule);
  }

  /**
   * Get all rules that are marked as mandatory.
   */
  public getMandatoryRules(): DesignRule[] {
    return this.library.getAllRules().filter(rule => rule.level === 'mandatory')
      .sort((a, b) => b.conflictPriority - a.conflictPriority || a.id.localeCompare(b.id));
  }
}
