import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DecisionLibrary } from '../src/decision-library/library.js';
import { RuleRetriever } from '../src/decision-library/retrieval.js';

export async function runQueryLibraryCli(args: string[]): Promise<number> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: zz-design query-library [keyword] [--validate] [--json] [--task NAME] [--platform NAME] [--product NAME]

Queries the Decision Library for rules matching the keyword.
If no keyword is provided, lists mandatory rules.
Use --validate to only validate the library data and exit.
    `);
    return 0;
  }

  const validateOnly = args.includes('--validate');
  const json = args.includes('--json');
  const query: { query?: string; task?: string; platform?: string; product?: string } = {};
  const words: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    if (arg === '--validate' || arg === '--json') continue;
    if (['--task', '--platform', '--product'].includes(arg)) {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      query[arg.slice(2) as 'task' | 'platform' | 'product'] = value;
    } else if (arg.startsWith('--')) throw new Error('Unknown query option');
    else words.push(arg);
  }
  const keyword = words.join(' ');
  query.query = keyword;

  const library = new DecisionLibrary();
  
  // Use the production library
  const moduleRoot = fileURLToPath(new URL('..', import.meta.url));
  const libraryPath = ['dist', 'dist-test'].includes(basename(moduleRoot)) ? resolve(moduleRoot, '..') : moduleRoot;
  
  try {
    library.loadFromRepository(libraryPath);
  } catch (error) {
    console.error('Failed to load the installed decision library');
    return 1;
  }

  if (validateOnly) {
    console.log(`Validation successful. Loaded ${library.getAllRules().length} rules.`);
    return 0;
  }

  const retriever = new RuleRetriever(library);
  const response = retriever.search(query);
  if (json) { process.stdout.write(`${JSON.stringify(response, null, 2)}\n`); return 0; }
  
  const rules = keyword || query.task || query.platform || query.product
    ? response.results.map(result => result.rule)
    : retriever.getMandatoryRules();

  if (rules.length === 0) {
    console.log(`No rules found${keyword ? ` matching "${keyword}"` : ''}.`);
    return 0;
  }

  console.log(`Found ${rules.length} rule(s):\n`);
  for (const rule of rules) {
    console.log(`[${rule.id}] ${rule.title} (${rule.level})`);
    console.log(`  Category: ${rule.category}`);
    console.log(`  Statement: ${rule.statement}`);
    console.log(`  Applies to: ${rule.taskApplicability.join(', ')}\n`);
  }

  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('query-library.js')) {
  runQueryLibraryCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  }).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
