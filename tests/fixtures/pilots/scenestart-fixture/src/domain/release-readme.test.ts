import { expect, it } from 'vitest';
import { assetUnresolved, createReleaseReadme } from './release-readme.js';

it('exports current production, disclosure, credits and unresolved rights', () => {
  const asset = { name: 'Texture', creator: 'Creator', licence: '', confirmed: true };
  expect(assetUnresolved(asset)).toBe(true);
  const text = createReleaseReadme('Signal Arc', 'Planning assistance', [asset]);
  for (const value of ['Signal Arc', 'Planning assistance', 'Creator', 'UNRESOLVED', 'does not certify']) expect(text).toContain(value);
  expect(createReleaseReadme('Signal Arc', '', [{ ...asset, licence: 'Owner permission' }])).toContain('User-confirmed; not independently verified');
});
