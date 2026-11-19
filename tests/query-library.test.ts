import { test } from 'node:test';
import * as assert from 'node:assert';
import { runQueryLibraryCli } from '../cli/query-library.js';

test('query-library CLI handles --help', async () => {
  const originalLog = console.log;
  let logged = false;
  console.log = () => { logged = true; };
  try {
    const exitCode = await runQueryLibraryCli(['--help']);
    assert.strictEqual(exitCode, 0);
    assert.strictEqual(logged, true);
  } finally {
    console.log = originalLog;
  }
});

test('query-library CLI validates library data', async () => {
  const originalLog = console.log;
  let logged = false;
  console.log = () => { logged = true; };
  try {
    const exitCode = await runQueryLibraryCli(['--validate']);
    assert.strictEqual(exitCode, 0);
    assert.strictEqual(logged, true);
  } finally {
    console.log = originalLog;
  }
});

test('query-library CLI searches by keyword and handles no match', async () => {
  const originalLog = console.log;
  let logs: string[] = [];
  console.log = (msg: string) => { logs.push(msg); };
  try {
    const exitCode = await runQueryLibraryCli(['non_existent_keyword_12345']);
    assert.strictEqual(exitCode, 0);
    assert.strictEqual(logs.some(l => l.includes('No rules found matching "non_existent_keyword_12345"')), true);
  } finally {
    console.log = originalLog;
  }
});

test('query-library CLI searches for an existing keyword', async () => {
  const originalLog = console.log;
  let logs: string[] = [];
  console.log = (msg: string) => { logs.push(msg); };
  try {
    const exitCode = await runQueryLibraryCli(['accessibility']);
    assert.strictEqual(exitCode, 0);
    assert.strictEqual(logs.some(l => l.includes('Found')), true);
  } finally {
    console.log = originalLog;
  }
});
