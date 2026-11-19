import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { DecisionLibrary } from '../src/decision-library/library.js';
import { DecisionEngine } from '../src/decision-library/engine.js';
import { RuleRetriever } from '../src/decision-library/retrieval.js';
import { evaluateBoundObservations } from '../src/decision-library/observations.js';
import { ruleFingerprint } from '../src/decision-library/provenance.js';
import { evaluatePrivateHoldout } from '../src/decision-library/holdout.js';

function library() { const result = new DecisionLibrary(); result.loadFromRepository(process.cwd()); return result; }
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

test('maintained decision identities and fingerprints remain independent of legacy auditors', () => {
  const rules = library().getAllRules();
  assert.equal(rules.length, 18);
  assert.equal(new Set(rules.map(rule => rule.id)).size, 18);
  for (const rule of rules) {
    assert.match(rule.id, /^ZTDE-LIB-/);
    assert.equal(rule.provenance?.ruleSha256, ruleFingerprint(rule));
    assert.equal(rule.provenance?.reviewerClass, 'ai-assisted');
    assert.equal(rule.provenance?.authority, 'project-policy');
  }
  const provenance = spawnSync(process.execPath, ['scripts/compile-decision-provenance.mjs'], { encoding: 'utf8' });
  assert.equal(provenance.status, 0, provenance.stderr);
});

test('ranked retrieval is deterministic, scoped, and explicitly abstains on empty or unrelated queries', () => {
  const l = library(); const retriever = new RuleRetriever(l);
  const result = retriever.search({ query: 'contrast', task: 'dashboard', platform: 'web' });
  assert.equal(result.results[0]?.rule.id, 'ZTDE-LIB-A11Y-001');
  assert.deepEqual(result, retriever.search({ query: 'contrast', task: 'dashboard', platform: 'web' }));
  assert.equal(retriever.search({ query: 'xylophone' }).status, 'no-match');
  assert.equal(retriever.search({ query: 'non_existent_keyword_12345' }).status, 'no-match');
  assert.equal(retriever.search({ query: 'ZTDE-LIB-A11Y-001' }).results[0]?.rule.id, 'ZTDE-LIB-A11Y-001');
  for (const rule of l.getAllRules()) assert.equal(retriever.search({ query: rule.id }).results[0]?.rule.id, rule.id);
  assert.equal(retriever.search({ query: '' }).status, 'no-match');
  assert.equal(retriever.search({ query: 'the and of' }).status, 'no-match');
  assert.ok(retriever.search({ query: 'keyboard', platform: 'mobile' }).results.every(result => result.rule.id !== 'ZTDE-LIB-A11Y-003'));
  assert.equal(result.confidenceMeaning, 'lexical-relevance-not-evidence-or-probability');
  const reversed = new DecisionLibrary();
  l.getAllRules().reverse().forEach(rule => reversed.addRule(rule));
  assert.deepEqual(result, new RuleRetriever(reversed).search({ query: 'contrast', task: 'dashboard', platform: 'web' }));
});

test('declared conflicts abstain symmetrically without hiding independent failures', () => {
  const original = library().getAllRules()[0]!;
  const a = { ...original, id: 'ZTDE-LIB-TEST-001', threshold: { type: 'qualitative' as const, value: 'yes' }, conflictsWith: ['ZTDE-LIB-TEST-002'] };
  const b = { ...a, id: 'ZTDE-LIB-TEST-002', conflictsWith: [] };
  const report = new DecisionEngine().evaluate('conflict', [a, b], { [a.id]: 'yes', [b.id]: 'yes' });
  assert.equal(report.summary.abstained, 2);
  assert.equal(new DecisionEngine().evaluate('conflict', [a, b], { [a.id]: 'yes', [b.id]: 'no' }).summary.failed, 1);
});

test('decision library loads without Markdown sources and rejects semantic tampering', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ztde-library-offline-'));
  try {
    await mkdir(join(root, 'model'));
    const bytes = await readFile('model/decision-library.json', 'utf8');
    await writeFile(join(root, 'model/decision-library.json'), bytes);
    const l = new DecisionLibrary(); l.loadFromRepository(root);
    assert.equal(l.getAllRules().length, 18);
    const duplicated = JSON.parse(bytes); duplicated.push(duplicated[0]);
    await writeFile(join(root, 'model/decision-library.json'), JSON.stringify(duplicated));
    assert.throws(() => l.loadFromRepository(root), /Duplicate/);
    assert.equal(l.getAllRules().length, 18);
    const changed = JSON.parse(bytes); changed[0].threshold.value = '1';
    await writeFile(join(root, 'model/decision-library.json'), JSON.stringify(changed));
    assert.throws(() => l.loadFromRepository(root), /provenance/);
    assert.equal(l.getAllRules()[0]?.threshold.value, '4.5');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('bound observations reject stale, mismatched, duplicated, forged-class and escaped evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ztde-observations-'));
  try {
    const l = library(); const rule = l.getAllRules()[0]!;
    const artifact = JSON.stringify({ measuredContrast: 5 });
    await writeFile(join(root, 'scan.json'), artifact);
    const entry = { ruleId: rule.id, ruleSha256: rule.provenance!.ruleSha256, value: 5, evidenceClass: 'automated',
      reviewer: 'synthetic-test', method: 'Synthetic contrast fixture measurement', observation: 'Synthetic sample ratio is five',
      validationMethod: 'Compare the ratio with the declared threshold', artifact: 'scan.json', artifactSha256: hash(artifact) };
    const bundle = { version: '1.0', productId: 'fixture', sourceDigest: hash('source'), capturedAt: new Date().toISOString(), observations: [entry] };
    const run = () => evaluateBoundObservations({ root, path: 'bundle.json', productId: 'fixture', sourceDigest: hash('source'), library: l });
    await writeFile(join(root, 'bundle.json'), JSON.stringify(bundle));
    const report = await run();
    assert.equal(report.status, 'unresolved');
    assert.equal(report.missingRuleIds.length, 17);
    await writeFile(join(root, 'bundle.json'), JSON.stringify({ ...bundle, observations: [{ ...entry, value: 2 }] }));
    const failed = await run();
    assert.equal(failed.status, 'fail');
    assert.equal(failed.missingRuleIds.length, 17);
    for (const bad of [
      { ...bundle, productId: 'other' }, { ...bundle, sourceDigest: hash('stale') },
      { ...bundle, observations: [entry, entry] },
      { ...bundle, observations: [{ ...entry, artifactSha256: hash('wrong') }] },
      { ...bundle, observations: [{ ...entry, ruleSha256: hash('old') }] },
      { ...bundle, observations: [{ ...entry, artifact: '../outside.json' }] },
      { ...bundle, observations: [{ ...entry, ruleId: 'ZTDE-LIB-A11Y-003', ruleSha256: l.getRule('ZTDE-LIB-A11Y-003')!.provenance!.ruleSha256 }] },
    ]) {
      await writeFile(join(root, 'bundle.json'), JSON.stringify(bad)); await assert.rejects(run);
    }
    await symlink('/etc/hosts', join(root, 'escaped.json'));
    await writeFile(join(root, 'bundle.json'), JSON.stringify({ ...bundle, observations: [{ ...entry, artifact: 'escaped.json' }] }));
    await assert.rejects(run, /escapes/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('every maintained rule has positive, negative, and missing-signal regression coverage', () => {
  const engine = new DecisionEngine();
  for (const rule of library().getAllRules()) {
    const positive = rule.threshold.type === 'quantitative' ? Number(rule.threshold.value) : rule.threshold.value;
    const negative = rule.threshold.type === 'quantitative'
      ? Number(rule.threshold.value) + (rule.threshold.comparison === 'at-most' ? 1 : -1) : 'synthetic-unmet-condition';
    assert.equal(engine.evaluate('synthetic-positive', [rule], { [rule.id]: positive }).summary.passed, 1, rule.id);
    assert.equal(engine.evaluate('synthetic-negative', [rule], { [rule.id]: negative }).summary.failed, 1, rule.id);
    assert.equal(engine.evaluate('synthetic-missing', [rule], {}).summary.passed, 0, rule.id);
  }
});

test('private holdout binds authorization and source evidence without claiming rendered verification', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ztde-holdout-reader-'));
  try {
    const registry = { version: '1.0', id: 'synthetic', description: 'Synthetic authorization fixture',
      roots: [{ id: 'root', class: 'studio-personal', path: root }],
      projects: [{ id: 'fixture', root: 'root', path: '.', enabled: true, ownership: 'first-party',
        confidentiality: 'private-local', cohort: 'holdout',
        publication: { sourceExcerpts: false, screenshots: false, machineReports: false, aggregateMetrics: false },
        product: { domain: 'test', archetype: 'utility', intendedUsers: ['tester'], primaryTasks: ['test'] },
        technology: { framework: 'static', packageManager: 'none', entrypoint: 'index.html' },
        capabilities: [{ stage: 'source-audit', status: 'supported', reason: 'Synthetic source stage' }],
        execution: { fixtureMode: 'disconnected', networkPolicy: 'denied', lifecycleScripts: false },
        paths: { include: ['**'] }, source: { revisionPolicy: 'capture-current', canonicalizationKey: 'fixture' } }],
    };
    const bytes = JSON.stringify(registry);
    await writeFile(join(root, 'registry.json'), bytes);
    const now = new Date().toISOString();
    const project = { projectId: 'fixture', cohort: 'holdout', sourceDigest: hash('source'),
      environmentPolicy: { network: 'denied', lifecycleScripts: false, environmentVariables: [] },
      commands: [], startedAt: now, completedAt: now, artifacts: [], status: 'limitations',
      stages: [{ stage: 'source-audit', status: 'passed', reason: 'Synthetic source inspection' },
        { stage: 'browser-journeys', status: 'unsupported', reason: 'No browser evidence' }] };
    const report = { version: '1.2.0', toolVersion: 'test', runId: 'synthetic', mode: 'cohort', registryId: 'synthetic',
      registryDigest: hash(bytes), cohort: 'holdout', projectIds: ['fixture'], startedAt: now, completedAt: now,
      projects: [project], summary: { passed: 0, findings: 0, limitations: 1, unsafeConfiguration: 0, sourceMutation: 0 },
      resultFingerprint: hash('report'), passed: true };
    await writeFile(join(root, 'report.json'), JSON.stringify(report));
    const run = () => evaluatePrivateHoldout({ registryRoot: root, registryPath: 'registry.json', evidenceRoot: root,
      reportPath: 'report.json', library: library() });
    const result = await run();
    assert.equal(result.status, 'unresolved'); assert.equal(result.executionPerformed, false);
    assert.equal(result.visibility, 'private-local'); assert.equal(result.results[0]?.missingRuleIds.length, 18);
    assert.deepEqual(result.results[0]?.unsupportedStages, ['browser-journeys']);
    await writeFile(join(root, 'report.json'), JSON.stringify({ ...report, registryDigest: hash('stale') }));
    await assert.rejects(run, /binding/);
    await writeFile(join(root, 'report.json'), JSON.stringify({ ...report, projects: [{ ...project, cohort: 'development' }] }));
    await assert.rejects(run, /Development/);
    await writeFile(join(root, 'report.json'), JSON.stringify({ ...report, projects: [{ ...project, status: 'source-mutation' }] }));
    assert.equal((await run()).status, 'fail');
  } finally { await rm(root, { recursive: true, force: true }); }
});
