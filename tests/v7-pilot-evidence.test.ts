import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { DecisionLibrary } from '../src/decision-library/library.js';
import { capturePilotSource, evaluatePilotCapture, pilotScope } from '../src/decision-library/pilot-evidence.js';

test('pilot qualification binds the complete cohort, source, contracts and raw reports instead of trusting passes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ztde-pilot-binding-'));
  const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
  const put = async (path: string, value: unknown) => {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value));
  };
  try {
    const bytes = await readFile('model/decision-library.json');
    await put('model/decision-library.json', bytes);
    const library = new DecisionLibrary(); library.loadFromRepository(root);
    const results = [];
    for (const product of pilotScope) {
      const source = `tests/fixtures/pilots/${product.id}-fixture`;
      await put(`${source}/src/App.tsx`, 'synthetic source');
      for (const file of ['index.html', 'package.json', 'package-lock.json', 'vite.config.ts']) await put(`${source}/${file}`, '{}');
      const manifest = await capturePilotSource(join(root, source));
      await put(`capture/${product.id}/source-manifest.json`, manifest);
      const profiles = [];
      for (const [file, ids] of [['journeys.json', product.main], ['interaction-journeys.json', product.interaction]] as const) {
        await put(`knowledge-base/benchmarks/${product.id}/${file}`, '{}');
        for (const profile of ids) {
          const runtime = JSON.stringify({ passed: true, summary: { errors: 0 }, viewports: [320, 768, 1440].map(width => ({ name: `w${width}`, width })) });
          const artifact = `${product.id}/${profile}/runtime-report.json`;
          await put(`capture/${artifact}`, runtime);
          profiles.push({ profile, artifact, artifactSha256: hash(runtime), contractSha256: hash('{}') });
        }
      }
      results.push({ productId: product.id, sourceDigest: manifest.sha256, sourceUnchanged: true as const, profiles });
    }
    const capture = { version: '1.0', exportPolicyVersion: '1.0', scope: 'maintained-pilot-runtime-samples', librarySha256: hash(bytes), status: 'pass', results };
    await put('capture/pilot-report.json', capture);
    const run = () => evaluatePilotCapture({ projectRoot: root, evidenceRoot: root, path: 'capture/pilot-report.json', library });
    const report = await run();
    assert.equal(report.length, 3);
    assert.ok(report.every(result => result.status === 'unresolved' && result.unsupportedRuleIds.length === 16));
    await put('capture/pilot-report.json', { ...capture, results: [results[0], results[0], results[2]] });
    await assert.rejects(run, /cohort/);
    await put('capture/pilot-report.json', { ...capture, librarySha256: hash('stale') });
    await assert.rejects(run, /library/);
    await put('capture/pilot-report.json', { ...capture, results: results.map((result, index) => index ? result : { ...result, profiles: result.profiles.slice(1) }) });
    await assert.rejects(run, /profiles/);
    await put('capture/pilot-report.json', capture);
    await put('tests/fixtures/pilots/aegisops-fixture/src/added.ts', 'new unrecorded source');
    await assert.rejects(run, /source changed/);
    await rm(join(root, 'tests/fixtures/pilots/aegisops-fixture/src/added.ts'));
    await put('capture/aegisops/demo-success/runtime-report.json', '{}');
    await assert.rejects(run, /digest mismatch/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
