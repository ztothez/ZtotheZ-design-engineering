import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { resolveChromiumPath } from '../dist/src/runtime/policy.js';
import { readBoundedEvidence } from '../dist/src/decision-library/observations.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.ztothez-design-runtime');
const capture = process.argv[2];
if (process.argv.length !== 3 || !/^v7-pilots-[a-zA-Z0-9.-]+$/.test(capture ?? '')) throw new Error('Supply the private V7 pilot capture directory name');
if (await realpath(join(root, capture)) !== join(root, capture)) throw new Error('Capture directory must not be a symlink');
const html = await readBoundedEvidence(root, `${capture}/scenestart/studio-export/journey-compose-save-export-step-13-my-production.html`);
const project = JSON.parse((await readBoundedEvidence(root, `${capture}/scenestart/studio-export/journey-compose-save-export-step-11-scenestart-production.json`)).toString('utf8'));
if (project.version !== 2 || project.handle !== 'ZSCENE' || project.scenes.length < 3) throw new Error('Exported project does not match the journey');
const output = join(root, capture, `offline-${Date.now()}`);
await mkdir(output);
const browser = await chromium.launch({ headless: true, executablePath: resolveChromiumPath(), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const results = [];
const hash = value => createHash('sha256').update(value).digest('hex');
try {
  for (const width of [320, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'no-preference', offline: true });
    const page = await context.newPage();
    const errors = []; const requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(request.url()));
    await context.route('**/*', route => route.abort());
    await page.setContent(html.toString('utf8'), { waitUntil: 'load' });
    await page.waitForTimeout(100);
    const embedded = await page.locator('#project').textContent();
    const identityMatches = JSON.stringify(JSON.parse(embedded)) === JSON.stringify(project);
    const before = await page.locator('canvas').evaluate(canvas => canvas.toDataURL());
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.waitForTimeout(300);
    const after = await page.locator('canvas').evaluate(canvas => canvas.toDataURL());
    await page.keyboard.press('Escape');
    const paused = await page.getByRole('button', { name: 'Play', exact: true }).count() === 1;
    const nonblank = await page.locator('canvas').evaluate(canvas => {
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = new Set();
      for (let i = 0; i < pixels.length; i += 4) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]},${pixels[i + 3]}`);
      return colors.size > 10;
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.waitForTimeout(100);
    const reducedBefore = await page.locator('canvas').evaluate(canvas => canvas.toDataURL());
    await page.waitForTimeout(200);
    const reducedAfter = await page.locator('canvas').evaluate(canvas => canvas.toDataURL());
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    const screenshot = join(output, `offline-${width}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    const result = { width, identityMatches, nonblank, moving: before !== after, paused,
      reducedMotionStatic: reducedBefore === reducedAfter, overflow, errors, networkRequests: requests.length,
      screenshot: `offline-${width}.png`, screenshotSha256: hash(await readFile(screenshot)) };
    results.push({ ...result, passed: identityMatches && nonblank && before !== after && paused
      && reducedBefore === reducedAfter && !overflow && !errors.length && !requests.length });
    await context.close();
  }
} finally { await browser.close(); }
const report = { version: '1.0', scope: 'exported-starter-production', htmlSha256: hash(html), results,
  passed: results.every(result => result.passed), limitations: ['Short playback sample and two widths; not a complete creative-product or assistive-technology certification.'] };
await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
console.error(JSON.stringify({ output, ...report }, null, 2));
process.exitCode = report.passed ? 0 : 1;
