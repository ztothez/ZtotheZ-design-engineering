import { describe, it, expect } from 'vitest';
import { createSyntheticSigma } from './sigma-export.js';

describe('synthetic export boundary', () => {
  it('binds the artifact to the selected technique and discloses its limits', () => {
    for (const technique of ['T1059.001', 'T1003']) {
      const artifact = createSyntheticSigma(technique);
      expect(artifact.filename).toBe(`sigma_${technique}.yml`);
      expect(artifact.body).toContain(`fixture_technique: ${technique}`);
      expect(artifact.body).toContain('Non-deployable demonstration data');
      expect(artifact.body).toContain('condition: selection');
    }
  });
  it('rejects empty, invalid, and injected identifiers', () => {
    for (const value of ['', 'arbitrary target', 'T1003\nstatus: stable']) expect(() => createSyntheticSigma(value)).toThrow();
  });
});
