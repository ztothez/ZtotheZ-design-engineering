import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { DecisionLibrary } from './library.js';
import { DecisionEngine } from './engine.js';
import { readBoundedEvidence, evaluateBoundObservations } from './observations.js';
import { extractRuntimeSignals } from './evidence.js';
import { pilotExportPolicyVersion } from './pilot-export-checks.js';

export const pilotScope = [
  { id: 'aegisops', main: ['demo-success', 'offline-recovery', 'responsive-overview'], interaction: ['interaction-qualification'] },
  { id: 'scenestart', main: ['studio-export', 'guided-workshop', 'learning-persistence', 'release-provenance'], interaction: ['workshop-interaction-qualification', 'studio-interaction-qualification'] },
  { id: 'azure-optimizer', main: ['overview-baseline', 'ztothez-analysis'], interaction: ['holdout-interaction-qualification'] },
] as const;
const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const digest = z.string().regex(/^[a-f0-9]{64}$/);

export async function capturePilotSource(root: string) {
  const entries: { path: string; sha256: string }[] = [];
  async function walk(directory: string) {
    for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('Pilot source symlinks are not allowed');
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) {
        if (entries.length >= 1000) throw new Error('Pilot source file limit exceeded');
        entries.push({ path, sha256: hash(await readBoundedEvidence(root, path)) });
      }
    }
  }
  await walk('src');
  for (const path of ['index.html', 'package.json', 'package-lock.json', 'vite.config.ts']) entries.push({ path, sha256: hash(await readBoundedEvidence(root, path)) });
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return { entries, sha256: hash(JSON.stringify(entries)), scope: 'src,index.html,package.json,package-lock.json,vite.config.ts' };
}
const captureSchema = z.object({
  version: z.literal('1.0'), scope: z.literal('maintained-pilot-runtime-samples'), librarySha256: digest,
  exportPolicyVersion: z.literal(pilotExportPolicyVersion),
  results: z.array(z.object({ productId: z.string(), sourceDigest: digest, sourceUnchanged: z.literal(true),
    profiles: z.array(z.object({ profile: z.string(), artifact: z.string(), artifactSha256: digest, contractSha256: digest })),
  })),
});

/** Re-evaluate bound raw reports; never trust a stored aggregate pass or supplied decision list. */
export async function evaluatePilotCapture(options: {
  projectRoot: string; evidenceRoot: string; path: string; library: DecisionLibrary;
  bundles?: Record<string, string>;
}) {
  const captured = captureSchema.parse(JSON.parse((await readBoundedEvidence(options.evidenceRoot, options.path)).toString('utf8')));
  if (captured.librarySha256 !== hash(await readBoundedEvidence(options.projectRoot, 'model/decision-library.json'))) throw new Error('Stale pilot library binding');
  if (captured.results.length !== pilotScope.length || new Set(captured.results.map(item => item.productId)).size !== pilotScope.length) throw new Error('Incomplete or duplicate pilot cohort');
  const results = [];
  for (const product of pilotScope) {
    const entry = captured.results.find(item => item.productId === product.id);
    const expected = [...product.main, ...product.interaction];
    if (!entry || entry.profiles.length !== expected.length || new Set(entry.profiles.map(item => item.profile)).size !== expected.length
      || expected.some(id => !entry.profiles.some(item => item.profile === id))) throw new Error('Incomplete or duplicate pilot profiles');
    const prefix = dirname(options.path);
    const manifest = z.object({ sha256: digest, entries: z.array(z.object({ path: z.string(), sha256: digest }).strict()).min(1) }).parse(
      JSON.parse((await readBoundedEvidence(options.evidenceRoot, join(prefix, product.id, 'source-manifest.json'))).toString('utf8')));
    if (manifest.sha256 !== entry.sourceDigest || hash(JSON.stringify(manifest.entries)) !== entry.sourceDigest
      || new Set(manifest.entries.map(item => item.path)).size !== manifest.entries.length) throw new Error('Invalid pilot source manifest');
    const current = await capturePilotSource(join(options.projectRoot, 'tests/fixtures/pilots', `${product.id}-fixture`));
    if (current.sha256 !== entry.sourceDigest) throw new Error('Pilot source changed or manifest scope is incomplete');
    const profiles = [];
    for (const profile of entry.profiles) {
      const artifact = `${product.id}/${profile.profile}/runtime-report.json`;
      if (profile.artifact !== artifact) throw new Error('Mismatched pilot artifact');
      const contractFile = (product.main as readonly string[]).includes(profile.profile) ? 'journeys.json' : 'interaction-journeys.json';
      if (hash(await readBoundedEvidence(options.projectRoot, `knowledge-base/benchmarks/${product.id}/${contractFile}`)) !== profile.contractSha256) throw new Error('Stale pilot contract binding');
      const bytes = await readBoundedEvidence(options.evidenceRoot, join(prefix, artifact));
      if (hash(bytes) !== profile.artifactSha256) throw new Error('Pilot report digest mismatch');
      const runtime = JSON.parse(bytes.toString('utf8'));
      const evidence = extractRuntimeSignals(runtime, artifact, profile.profile);
      const rules = options.library.getAllRules().filter(rule => evidence.supportedRuleIds.includes(rule.id));
      const decision = new DecisionEngine().evaluate(`${product.id}:${profile.profile}`, rules, evidence.signals);
      profiles.push({ profile: profile.profile, runtimePassed: runtime.passed === true, evidence, decision });
    }
    let boundDecision: Awaited<ReturnType<typeof evaluateBoundObservations>> | undefined;
    const bundlePath = options.bundles?.[product.id];
    if (bundlePath) {
      boundDecision = await evaluateBoundObservations({
        root: options.evidenceRoot, path: bundlePath, productId: product.id,
        sourceDigest: entry.sourceDigest, library: options.library,
      });
    }
    const supported = new Set([
      ...profiles.flatMap(profile => profile.evidence.supportedRuleIds),
      ...(boundDecision ? Object.keys(boundDecision.evidenceClasses) : []),
    ]);
    const unsupportedRuleIds = options.library.getAllRules().filter(rule => !supported.has(rule.id)).map(rule => rule.id);
    const failed = profiles.some(profile => !profile.runtimePassed || profile.decision.summary.failed > 0)
      || boundDecision?.status === 'fail';
    results.push({ product: product.id, cohort: 'development', sourceDigest: entry.sourceDigest,
      status: failed ? 'fail' : unsupportedRuleIds.length ? 'unresolved' : 'pass',
      supportedStatus: failed ? 'fail' : supported.size ? 'pass' : 'unresolved',
      supportedRules: [...supported], unsupportedRuleIds, profiles,
      ...(boundDecision ? { boundObservations: boundDecision } : {}),
      limitations: ['Bound maintained-fixture samples only; not all product states or original portfolio applications.',
        'Checksums bind supplied artifacts; they do not certify the producer or replace observation review.'],
    });
  }
  return results;
}
