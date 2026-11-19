import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { chromium } from 'playwright-core';
import { resolveChromiumPath } from '../dist/src/runtime/policy.js';
import { capturePilotSource } from '../dist/src/decision-library/pilot-evidence.js';

// Fixed repository-owned fixtures only; no remote URLs or portfolio source execution.
if (process.argv.length !== 2) throw new Error('This review regression takes no arguments.');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = join(root, '.ztothez-design-runtime');
await mkdir(runtime, { recursive: true });
assert.equal(await realpath(runtime), runtime);
const output = join(runtime, `v7-review-fixes-${new Date().toISOString().replace(/[:.]/g, '-')}`);
await mkdir(output);
const execute = promisify(execFile);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const browser = await chromium.launch({ executablePath: resolveChromiumPath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const results = [];
try {
  for (const product of ['aegisops', 'scenestart', 'azure-optimizer']) {
    const fixture = join(root, 'tests/fixtures/pilots', `${product}-fixture`);
    assert.equal(await realpath(fixture), fixture);
    const source = await capturePilotSource(fixture);
    await writeFile(join(output, `${product}-source.json`), JSON.stringify(source, null, 2));
    const build = await execute('npm', ['run', 'build'], { cwd: fixture, timeout: 180000 });
    await writeFile(join(output, `${product}-build.log`), build.stdout + build.stderr);
    const { preview } = await import(pathToFileURL(join(fixture, 'node_modules/vite/dist/node/index.js')).href);
    const server = await preview({ root: fixture, configFile: join(fixture, 'vite.config.ts'), logLevel: 'silent',
      preview: { host: '127.0.0.1', port: 0 } });
    try {
      const address = server.httpServer.address();
      assert.ok(address && typeof address !== 'string');
      for (const colorScheme of ['light', 'dark']) for (const width of [320, 768, 1024, 1440]) {
        const page = await browser.newPage({ viewport: { width, height: 1000 }, colorScheme });
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.goto(`http://127.0.0.1:${address.port}/${product === 'scenestart' ? 'studio' : ''}`);
        if (product === 'scenestart') {
          await page.getByLabel('Handle', { exact: true }).fill('ZSCENE');
          await page.getByLabel('Concept', { exact: true }).fill('Review spacing with an editable project concept');
          await page.getByLabel('Title', { exact: true }).fill('Opening');
          assert.ok(await gap(page, '.project-fields', '.production-preview') >= 16);
          assert.ok(await separated(page, '.project-fields input'));
          assert.ok(await separated(page, '.production-actions button'));
          for (const label of await page.locator('.project-fields label').all()) {
            const text = await label.locator('span').boundingBox(); const input = await label.locator('input').boundingBox();
            assert.ok(text && input && input.y - text.y - text.height >= 8);
          }
          await page.getByRole('button', { name: 'PLAY PRODUCTION', exact: true }).click();
          await page.getByRole('button', { name: 'PAUSE', exact: true }).click();
          assert.equal(await page.getByLabel('Handle', { exact: true }).inputValue(), 'ZSCENE');
        }
        if (product === 'aegisops') {
          let requests = 0;
          page.on('request', request => { if (new URL(request.url()).pathname === '/run') requests++; });
          const input = page.getByLabel('ATT&CK technique or target');
          await input.fill('invalid'); await input.press('Enter');
          await page.locator('.status--error').waitFor(); assert.equal(requests, 0);
          assert.match(await page.getByRole('alert').innerText(), /Enter an ATT&CK identifier/);
          await input.fill('T1059.001'); await input.press('Enter');
          await page.locator('.status--error').waitFor(); assert.equal(requests, 1);
          assert.match(await page.getByRole('alert').innerText(), /deliberate recovery test/);
          const failedRetry = page.waitForResponse(response => response.url().endsWith('/run') && response.status() === 500);
          await page.getByRole('button', { name: 'Retry', exact: true }).click(); await failedRetry;
          await page.locator('.status--error').waitFor(); assert.equal(requests, 2);
          await page.getByRole('switch', { name: 'Enable Demo mode' }).press('Enter');
          assert.match(await page.getByRole('switch').innerText(), /On/);
          assert.match(await page.locator('.configuration-status').innerText(), /Demo mode on/);
          await page.getByRole('button', { name: 'Retry', exact: true }).click();
          await page.locator('.status--success').waitFor(); assert.equal(requests, 3);
          assert.match(await page.locator('.pipeline-result').innerText(), /T1059.001/);
          await input.press('Enter'); await page.waitForTimeout(100); assert.equal(requests, 3);
          await input.fill('');
          await page.getByRole('button', { name: 'Single Technique', exact: true }).click();
          assert.equal(await input.inputValue(), 'T1059.001');
          assert.equal(await page.getByRole('button', { name: 'Single Technique', exact: true }).getAttribute('aria-pressed'), 'true');
          await input.press('Enter'); await page.locator('.status--success').waitFor(); assert.equal(requests, 4);
          await page.getByRole('button', { name: 'live', exact: true }).click();
          await input.press('Enter'); await page.waitForTimeout(100); assert.equal(requests, 4);
          assert.equal(await page.locator('.pipeline-result').count(), 0);
          await page.getByRole('button', { name: 'demo', exact: true }).click();
          await input.press('Enter'); await page.locator('.status--success').waitFor();
        } else {
          assert.ok(await gap(page, '.decision-layout', '.source-panel') >= 16);
          for (const mode of ['imported', 'cached', 'live', 'demo']) {
            await page.getByRole('button', { name: mode, exact: true }).click();
            assert.ok(await gap(page, '.source-panel .section-heading', '.mode-control') >= 16);
            assert.ok(await separated(page, '.mode-control button'));
            assert.ok(await separated(page, '.source-panel .source-facts > div'));
          }
          if (product === 'azure-optimizer') {
            const toggle = page.getByRole('button', { name: 'Analysis', exact: true });
            await toggle.click(); await page.getByRole('heading', { name: 'Resource analysis', exact: true }).waitFor();
            assert.equal(await page.evaluate(() => document.activeElement?.id), 'analysis-heading');
            assert.match(await page.locator('#analysis-panel').innerText(), /No audit has run yet/);
            await page.getByRole('button', { name: 'Run AI Audit', exact: true }).click();
            await page.locator('.analysis-findings').waitFor();
            assert.equal(await page.locator('.analysis-findings > li').count(), 3);
            assert.match(await page.locator('#analysis-panel').innerText(), /EUR 1,240/);
            await page.getByText('Validation for vm-prod-17', { exact: true }).click();
            assert.equal(await page.locator('details').first().getAttribute('open'), '');
            await toggle.click(); assert.equal(await page.locator('#analysis-panel').isVisible(), false);
            await toggle.click(); await page.getByRole('button', { name: 'live', exact: true }).click();
            assert.equal(await page.locator('.analysis-findings').count(), 0);
            assert.equal(await page.getByRole('button', { name: 'Run AI Audit', exact: true }).isDisabled(), true);
            await page.getByRole('button', { name: 'demo', exact: true }).click();
            await page.getByRole('button', { name: 'Return to review', exact: true }).click();
            assert.equal(await page.locator('#analysis-panel').isVisible(), false);
            await toggle.click(); await page.getByRole('button', { name: 'Run AI Audit', exact: true }).click();
          }
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.deepEqual(errors, []);
        await page.waitForTimeout(200);
        const screenshot = `${product}-${colorScheme}-${width}.png`;
        await page.screenshot({ path: join(output, screenshot), fullPage: true });
        results.push({ product, width, colorScheme, passed: true, sourceDigest: source.sha256,
          screenshot, screenshotSha256: hash(await readFile(join(output, screenshot))) });
        await page.close();
      }
      assert.equal((await capturePilotSource(fixture)).sha256, source.sha256);
    } finally { await server.close(); }
  }
} catch (error) {
  results.push({ passed: false, error: String(error) });
  process.exitCode = 1;
} finally { await browser.close(); }
await writeFile(join(output, 'report.json'), JSON.stringify({ version: '1.0', evidenceClass: 'automated',
  scope: 'owner-reported fixture spacing and Enter submission regressions', authority: 'V5',
  cutover: 'not-approved', passed: results.length === 24 && results.every(result => result.passed), results,
  limitations: ['Targeted geometry and keyboard checks, not complete usability or accessibility certification.',
    'Does not replace owner re-review or qualify the remaining V7 decision rules.'] }, null, 2));
console.error(output);
console.error(`${results.filter(result => result.passed).length}/24 review regression cases passed`);

async function gap(page, first, second) {
  const a = await page.locator(first).boundingBox(); const b = await page.locator(second).boundingBox();
  assert.ok(a && b); return b.y - a.y - a.height;
}
async function separated(page, selector) {
  return page.locator(selector).evaluateAll(elements => elements.every((element, index) => {
    const a = element.getBoundingClientRect();
    return elements.slice(index + 1).every(other => {
      const b = other.getBoundingClientRect();
      return a.right + 7 <= b.left || b.right + 7 <= a.left || a.bottom + 7 <= b.top || b.bottom + 7 <= a.top;
    });
  }));
}
