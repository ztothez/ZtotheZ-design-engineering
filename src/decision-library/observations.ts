import { readFile, realpath, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { z } from 'zod';
import { DecisionLibrary } from './library.js';
import { DecisionEngine } from './engine.js';

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const portablePath = z.string().min(1).max(512).refine(value => !isAbsolute(value)
  && !value.includes('\\') && !value.includes('\0') && !value.split('/').includes('..')
  && !/^[a-z]:/i.test(value));

export const decisionObservationSchema = z.object({
  ruleId: z.string().regex(/^ZTDE-LIB-/),
  ruleSha256: digest,
  value: z.union([z.string().min(1).max(512), z.number().finite(), z.boolean()]),
  evidenceClass: z.enum(['automated', 'ai-assisted', 'human-expert', 'representative-user', 'owner-review']),
  reviewer: z.string().min(1).max(128),
  method: z.string().min(10).max(2000),
  observation: z.string().min(10).max(4000),
  validationMethod: z.string().min(10).max(2000),
  artifact: portablePath,
  artifactSha256: digest,
}).strict();

export const decisionEvidenceSchema = z.object({
  version: z.literal('1.0'),
  productId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  sourceDigest: digest,
  capturedAt: z.string().datetime(),
  observations: z.array(decisionObservationSchema).max(100),
}).strict().superRefine((bundle, ctx) => {
  const ids = bundle.observations.map(item => item.ruleId);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', path: ['observations'], message: 'Duplicate observation rule' });
});

export async function readBoundedEvidence(root: string, path: string): Promise<Buffer> {
  portablePath.parse(path);
  const base = await realpath(root);
  const actual = await realpath(resolve(base, path));
  const relation = relative(base, actual);
  if (isAbsolute(relation) || relation === '..' || relation.startsWith(`..${sep}`)) throw new Error('Evidence path escapes allowed root');
  const info = await stat(actual);
  if (!info.isFile() || info.size > 16 * 1024 * 1024) throw new Error('Evidence is not a bounded regular file');
  return readFile(actual);
}

export async function evaluateBoundObservations(options: {
  root: string; path: string; productId: string; sourceDigest: string; library: DecisionLibrary;
}) {
  const bundle = decisionEvidenceSchema.parse(JSON.parse((await readBoundedEvidence(options.root, options.path)).toString('utf8')));
  if (bundle.productId !== options.productId || bundle.sourceDigest !== options.sourceDigest) throw new Error('Evidence product or source digest does not match');
  const signals: Record<string, string | number | boolean> = {};
  for (const entry of bundle.observations) {
    const rule = options.library.getRule(entry.ruleId);
    if (!rule?.provenance || rule.provenance.ruleSha256 !== entry.ruleSha256) throw new Error('Unknown or stale observation rule');
    const bytes = await readBoundedEvidence(options.root, entry.artifact);
    if (createHash('sha256').update(bytes).digest('hex') !== entry.artifactSha256) throw new Error('Observation artifact digest mismatch');
    if (entry.evidenceClass === 'automated' && ['review', 'manual-inspection'].includes(rule.verificationMethod)) {
      throw new Error('Automated evidence cannot replace the rule review method');
    }
    signals[entry.ruleId] = typeof entry.value === 'string' && rule.threshold.type === 'qualitative'
      && entry.value !== rule.threshold.value ? false : entry.value;
  }
  const report = new DecisionEngine().evaluate(bundle.productId, options.library.getAllRules(), signals);
  return {
    version: '1.0', productId: bundle.productId, sourceDigest: bundle.sourceDigest,
    suppliedObservationCount: bundle.observations.length,
    missingRuleIds: options.library.getAllRules().filter(rule => signals[rule.id] === undefined).map(rule => rule.id),
    report,
    evidenceClasses: Object.fromEntries(bundle.observations.map(item => [item.ruleId, item.evidenceClass])),
    status: report.results.some(result => signals[result.ruleId] !== undefined && result.outcome === 'fail') ? 'fail'
      : bundle.observations.length < options.library.getAllRules().length || report.summary.abstained ? 'unresolved' : 'pass',
    limitations: ['Checksums establish artifact binding, not reviewer identity or the truth of a supplied observation.',
      'This importer preserves supplied evidence classes; it does not generate attestations or certify human participation.'],
  };
}
