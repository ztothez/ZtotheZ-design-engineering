import { describe, expect, it } from 'vitest';
import { createProduction, exportProduction, parseProduction } from './production.js';

describe('production artifact integrity', () => {
  it('round trips identity and ordered scenes, not an empty object', () => {
    const project = { ...createProduction('ZSCENE'), concept: 'Local arc', title: 'Signal opening' };
    expect(parseProduction(JSON.stringify(project))).toEqual(project);
    expect(project.scenes).toHaveLength(3);
  });
  it('rejects malformed, oversized, and invalid scene data', () => {
    for (const text of ['{}', 'broken', ' '.repeat(65537), JSON.stringify({ ...createProduction(), scenes: [] }),
      JSON.stringify({ ...createProduction(), handle: 'TOO-LONG-HANDLE' }),
      JSON.stringify({ ...createProduction(), scenes: [{ title: 'bad', duration: -1 }, ...createProduction().scenes] })]) {
      expect(() => parseProduction(text)).toThrow();
    }
  });
  it('embeds the current project safely in a self-contained playable export', () => {
    const project = { ...createProduction('ZSCENE'), title: '</script><script>bad()</script>' };
    const html = exportProduction(project);
    expect(html).toContain('<html'); expect(html).toContain('ZSCENE');
    expect(html).not.toContain(project.title);
    expect(html).toContain('requestAnimationFrame'); expect(html).toContain("event.key==='Escape'");
    expect(html).not.toContain('src="http');
  });
});
