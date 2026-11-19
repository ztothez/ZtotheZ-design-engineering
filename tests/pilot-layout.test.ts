import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium, type Page } from 'playwright-core';
import { resolveChromiumPath } from '../src/runtime/policy.js';

test('pilot CSS separates metadata, preview, actions and source boundary at maintained widths', async () => {
  const browser = await chromium.launch({ executablePath: resolveChromiumPath(), headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  const rect = async (selector: string) => {
    const box = await page.locator(selector).boundingBox();
    assert.ok(box, selector);
    return box;
  };
  const gap = async (first: string, second: string) => {
    const a = await rect(first); const b = await rect(second);
    return b.y - a.y - a.height;
  };
  try {
    for (const product of ['scenestart', 'azure-optimizer']) {
      const base = `tests/fixtures/pilots/${product}-fixture/src/styles`;
      const css = `${await readFile(`${base}/tokens.css`, 'utf8')}\n${await readFile(`${base}/app.css`, 'utf8')}`;
      for (const colorScheme of ['light', 'dark'] as const) for (const width of [320, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.emulateMedia({ colorScheme });
        // Isolated layout contract using the maintained CSS; live React journeys are verified separately.
        await page.setContent(`<style>${css}</style><main class="workspace">
          <section class="decision-layout"><div class="primary-flow">
            <div class="finding studio-editor"><div class="project-fields">
              <label><span>HANDLE</span><input aria-label="Handle" value="ZSCENE"></label>
              <label><span>CONCEPT</span><input aria-label="Concept" value="A long concept for the production"></label>
              <label><span>TITLE</span><input aria-label="Title" value="Opening"></label>
              <label class="project-upload"><span>PROJECT FILE</span><input type="file"></label>
            </div><div class="preview"><canvas class="production-preview" width="800" height="450"></canvas></div>
            <div class="production-actions"><button>PLAY PRODUCTION</button><button>EXPORT OFFLINE HTML</button></div>
            </div></div><aside class="recovery">Recovery</aside></section>
          <section class="source-panel"><div class="section-heading"><div><p>Data boundary</p><h2>Demonstration data</h2></div><span class="status">demo</span></div>
            <div class="mode-control"><button>demo</button><button>imported</button><button>cached</button><button>live</button></div>
            <dl class="source-facts"><div><dt>Origin</dt><dd>Local fixture</dd></div><div><dt>Freshness</dt><dd>Static fixture; no production timestamp</dd></div><div><dt>Connection</dt><dd>not-required</dd></div></dl>
          </section></main>`);
        assert.ok(await gap('.decision-layout', '.source-panel') >= 16, `${product}/${width}: section spacing`);
        if (product === 'scenestart') {
          assert.ok(await gap('.project-fields', '.preview') >= 16, `${width}: preview spacing`);
          for (const label of await page.locator('.project-fields label').all()) {
            const text = await label.locator('span').boundingBox(); const input = await label.locator('input').boundingBox();
            assert.ok(text && input && input.y - text.y - text.height >= 8, `${width}: label spacing`);
          }
          assert.ok(await separated(page, '.project-fields input'), `${width}: input overlap`);
          assert.ok(await separated(page, '.production-actions button'), `${width}: action overlap`);
          const regression = await page.addStyleTag({ content: '.studio-editor { gap: 0; }' });
          assert.ok(await gap('.project-fields', '.preview') < 16, 'negative control detects lost spacing');
          await regression.evaluate(element => element.parentNode?.removeChild(element));
        }
        assert.ok(await gap('.source-panel .section-heading', '.mode-control') >= 16);
        assert.ok(await separated(page, '.mode-control button'));
        assert.ok(await separated(page, '.source-facts > div'));
        // The Azure fixture has no metadata editor: avoid testing the synthetic Studio markup in that case.
        if (product === 'azure-optimizer') await page.locator('.studio-editor').evaluate(element => element.remove());
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      }
    }
  } finally { await browser.close(); }
});

async function separated(page: Page, selector: string) {
  return page.locator(selector).evaluateAll(elements => elements.every((element, i) => {
    const a = element.getBoundingClientRect();
    return elements.slice(i + 1).every(other => {
      const b = other.getBoundingClientRect();
      return a.right + 7 <= b.left || b.right + 7 <= a.left || a.bottom + 7 <= b.top || b.bottom + 7 <= a.top;
    });
  }));
}
