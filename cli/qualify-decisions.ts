import { basename, resolve } from 'node:path';
import { DecisionLibrary } from '../src/decision-library/library.js';
import { evaluateBoundObservations } from '../src/decision-library/observations.js';
import { fileURLToPath } from 'node:url';

export async function runQualifyDecisionsCli(args: string[]): Promise<number> {
  if (args.includes('--help')) {
    process.stdout.write('Usage: zz-design qualify-decisions --evidence-root DIR --bundle FILE --product ID --source-digest SHA256\n');
    return 0;
  }
  const values = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]!; const value = args[i + 1];
    if (!['--evidence-root', '--bundle', '--product', '--source-digest'].includes(key) || !value || values.has(key)) throw new Error('Invalid or duplicated qualification option');
    values.set(key, value);
  }
  if (values.size !== 4) throw new Error('All qualification options are required');
  const library = new DecisionLibrary();
  const moduleRoot = fileURLToPath(new URL('..', import.meta.url));
  library.loadFromRepository(['dist', 'dist-test'].includes(basename(moduleRoot)) ? resolve(moduleRoot, '..') : moduleRoot);
  const report = await evaluateBoundObservations({ root: values.get('--evidence-root')!, path: values.get('--bundle')!,
    productId: values.get('--product')!, sourceDigest: values.get('--source-digest')!, library });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report.status === 'pass' ? 0 : 1;
}
