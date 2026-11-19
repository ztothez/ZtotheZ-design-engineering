import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DecisionLibrary } from '../dist/src/decision-library/library.js';
import { DecisionEngine } from '../dist/src/decision-library/engine.js';
import { extractRuntimeSignals } from '../dist/src/decision-library/evidence.js';
import { loadRuntimeJourneySelection } from '../dist/src/contracts/journeys.js';
import { verifyUiRuntime } from '../dist/src/runtime/verifier.js';
import { pilotScope, capturePilotSource } from '../dist/src/decision-library/pilot-evidence.js';
import { withPilotExportChecks, pilotExportPolicyVersion } from '../dist/src/decision-library/pilot-export-checks.js';

// Only repository-owned fixtures are executed, never registry source projects.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv.length !== 2) throw new Error('This capture takes no arguments and runs only the maintained pilot fixtures.');
const runtime = join(root, '.ztothez-design-runtime');
await mkdir(runtime, { recursive: true });
if (await realpath(runtime) !== runtime) throw new Error('Private output root must not be a symlink');
const output = join(runtime, `v7-pilots-${new Date().toISOString().replace(/[:.]/g, '-')}`);
await mkdir(output);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const execute = promisify(execFile);
const library = new DecisionLibrary();
library.loadFromRepository(root);
const results = [];

for (const product of pilotScope) {
  const fixture = join(root, 'tests/fixtures/pilots', `${product.id}-fixture`);
  if (await realpath(fixture) !== fixture || await realpath(join(fixture, 'src')) !== join(fixture, 'src')) throw new Error('Pilot source escapes the maintained fixture');
  const folder = join(output, product.id);
  await mkdir(folder);
  const before = await capturePilotSource(fixture);
  await writeFile(join(folder, 'source-manifest.json'), JSON.stringify(before, null, 2));
  const build = await execute('npm', ['run', 'build'], { cwd: fixture, timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
  await writeFile(join(folder, 'build.log'), `${build.stdout}\n${build.stderr}`);
  const { preview } = await import(pathToFileURL(join(fixture, 'node_modules/vite/dist/node/index.js')).href);
  const server = await preview({ root: fixture, configFile: join(fixture, 'vite.config.ts'),
    logLevel: 'silent', preview: { host: '127.0.0.1', port: 0, strictPort: false } });
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') { await server.close(); throw new Error('Pilot server has no local address'); }
  const profiles = [];
  try {
    for (const [filename, names] of [['journeys.json', product.main], ['interaction-journeys.json', product.interaction]]) {
      const contractPath = join(root, 'knowledge-base/benchmarks', product.id, filename);
      const contractSha256 = hash(await readFile(contractPath));
      for (const profile of names) {
        console.error(`V7 pilot: ${product.id}/${profile}`);
        const selected = await loadRuntimeJourneySelection(contractPath, profile);
        const report = await verifyUiRuntime({ url: `http://127.0.0.1:${address.port}/`, outputDirectory: join(folder, profile),
          ...selected, journeys: withPilotExportChecks(product.id, selected.journeys), settleMs: 100, viewports: [
            { name: 'narrow', width: 320, height: 812 }, { name: 'tablet', width: 768, height: 1024 },
            { name: 'desktop', width: 1440, height: 1000 },
          ] });
        const artifact = `${product.id}/${profile}/runtime-report.json`;
        const evidence = extractRuntimeSignals(report, artifact, profile);
        const rules = library.getAllRules().filter(rule => evidence.supportedRuleIds.includes(rule.id));
        const decisions = new DecisionEngine().evaluate(`${product.id}:${profile}`, rules, evidence.signals);
        profiles.push({ profile, artifact, artifactSha256: hash(await readFile(join(output, artifact))), contractSha256,
          runtimePassed: report.passed, journeys: report.journeys, evidence, decisions });
      }
    }
  } finally {
    await server.close();
  }
  const unchanged = (await capturePilotSource(fixture)).sha256 === before.sha256;
  if (!unchanged) throw new Error('Maintained pilot source changed during capture');
  const supported = new Set(profiles.flatMap(profile => profile.evidence.supportedRuleIds));
  results.push({ productId: product.id, sourceDigest: before.sha256, sourceUnchanged: unchanged,
    status: profiles.some(profile => !profile.runtimePassed || profile.decisions.summary.failed) ? 'fail'
      : supported.size === library.getAllRules().length ? 'pass' : 'unresolved',
    missingRuleIds: library.getAllRules().filter(rule => !supported.has(rule.id)).map(rule => rule.id), profiles });
}
const report = { version: '1.0', scope: 'maintained-pilot-runtime-samples', generatedAt: new Date().toISOString(),
  exportPolicyVersion: pilotExportPolicyVersion,
  authority: 'V5', cutover: 'not-approved', librarySha256: hash(await readFile(join(root, 'model/decision-library.json'))),
  status: results.some(result => result.status === 'fail') ? 'fail' : results.every(result => result.status === 'pass') ? 'pass' : 'unresolved',
  results, limitations: ['Maintained fixtures, not original portfolio applications.', 'Three viewport widths and declared journeys only.',
    'Measured accessibility samples do not certify all accessibility behavior.', 'No private holdout execution or human evidence was generated.'] };
await writeFile(join(output, 'pilot-report.json'), JSON.stringify(report, null, 2));
await writeFile(join(output, 'REVIEW.md'), [
  '# V7 Pilot Review', '', 'This is a private local engineering review, not approval to publish or activate V7.', '',
  ...results.flatMap(result => [`## ${result.productId}`, '', `Result: ${result.status}; source unchanged: ${result.sourceUnchanged}.`, '',
    ...result.profiles.map(profile => `- [${profile.profile}](./${profile.artifact.replace('runtime-report.json', 'runtime-report.md')}): runtime ${profile.runtimePassed ? 'pass' : 'fail'}, ${profile.decisions.summary.failed} measured library failures.`),
    '', 'Still requiring evidence:', ...result.missingRuleIds.map(id => `- ${id}: ${library.getRule(id).title}. Method: ${library.getRule(id).verificationMethod}.`), '']),
  'Screenshots and journey artifacts are beside each runtime report. A missing observation is not a pass.',
].join('\n'));
console.error(`V7 capture: ${relative(root, output)} (${report.status})`);
process.exitCode = report.status === 'pass' ? 0 : 1;
