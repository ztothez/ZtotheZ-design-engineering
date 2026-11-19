import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const BASELINE_ROOT = resolve(process.argv.slice(2).find(arg => !arg.startsWith('--')) || process.env.ZTDE_BASELINE_ROOT || '.ztothez-design-runtime/v7-baseline/v200/package');
const CURRENT_ROOT = resolve('.');
const OUTPUT_DIR = '.ztothez-design-runtime/v7-baseline';
const packagedScope = process.argv.includes('--packaged-contracts');

function hashFile(filePath) {
  try {
    const content = readFileSync(filePath);
    return createHash('sha256').update(content).digest('hex');
  } catch {
    return null;
  }
}

function walk(dir) {
  const results = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        results.push(...walk(fullPath));
      } else {
        results.push(fullPath);
      }
    }
  } catch {
    // directory not accessible
  }
  return results;
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function extractJourneyCoverage(root, benchmarkPath) {
  const journeysPath = join(root, benchmarkPath, 'journeys.json');
  const interactionPath = join(root, benchmarkPath, 'interaction-journeys.json');
  const contractPath = join(root, benchmarkPath, 'product-contract.yaml');

  const journeys = readJsonSafe(journeysPath);
  const interactions = readJsonSafe(interactionPath);

  const coverage = {
    journeysFileExists: existsSync(journeysPath),
    interactionFileExists: existsSync(interactionPath),
    contractFileExists: existsSync(contractPath),
    journeysHash: hashFile(journeysPath),
    interactionHash: hashFile(interactionPath),
    profiles: [],
    interactionProfiles: [],
    totalJourneys: 0,
    totalSteps: 0,
    totalCheckpoints: 0,
    totalInteractionJourneys: 0,
    totalInteractionSteps: 0,
  };

  if (journeys?.profiles) {
    for (const profile of journeys.profiles) {
      const profileData = {
        id: profile.id,
        journeys: [],
      };
      for (const journey of (profile.journeys || [])) {
        const steps = journey.steps?.length || 0;
        const checkpoints = (journey.steps || []).filter(s => s.checkpoint).length;
        profileData.journeys.push({
          id: journey.id,
          steps,
          checkpoints,
          actions: journey.steps ?? [],
        });
        coverage.totalJourneys += 1;
        coverage.totalSteps += steps;
        coverage.totalCheckpoints += checkpoints;
      }
      coverage.profiles.push(profileData);
    }
  }

  if (interactions?.profiles) {
    for (const profile of interactions.profiles) {
      const profileData = {
        id: profile.id,
        journeys: [],
      };
      for (const journey of (profile.journeys || [])) {
        const steps = journey.steps?.length || 0;
        profileData.journeys.push({
          id: journey.id,
          steps,
        });
        coverage.totalInteractionJourneys += 1;
        coverage.totalInteractionSteps += steps;
      }
      coverage.interactionProfiles.push(profileData);
    }
  }

  return coverage;
}

function compareScripts(baselinePkg, currentPkg) {
  const baselineScripts = Object.keys(baselinePkg.scripts || {}).sort();
  const currentScripts = Object.keys(currentPkg.scripts || {}).sort();
  return {
    baselineCount: baselineScripts.length,
    currentCount: currentScripts.length,
    added: currentScripts.filter(s => !baselineScripts.includes(s)),
    removed: baselineScripts.filter(s => !currentScripts.includes(s)),
    shared: baselineScripts.filter(s => currentScripts.includes(s)),
  };
}

function compareJourneyCoverage(baselineCoverage, currentCoverage) {
  const differences = [];
  const baselineJourneyIds = new Set();
  const currentJourneyIds = new Set();

  for (const profile of baselineCoverage.profiles) {
    for (const journey of profile.journeys) {
      baselineJourneyIds.add(`${profile.id}/${journey.id}`);
    }
  }
  for (const profile of currentCoverage.profiles) {
    for (const journey of profile.journeys) {
      currentJourneyIds.add(`${profile.id}/${journey.id}`);
    }
  }

  for (const id of baselineJourneyIds) {
    if (!currentJourneyIds.has(id)) {
      differences.push({
        kind: 'missing-coverage',
        journeyId: id,
        detail: 'Journey present in 2.0.0 baseline but missing in current version.',
      });
    }
  }
  for (const id of currentJourneyIds) {
    if (!baselineJourneyIds.has(id)) {
      differences.push({
        kind: 'new-coverage',
        journeyId: id,
        detail: 'Journey present in current version but not in 2.0.0 baseline.',
      });
    }
  }

  // Compare step counts for shared journeys
  for (const baseProfile of baselineCoverage.profiles) {
    for (const baseJourney of baseProfile.journeys) {
      const key = `${baseProfile.id}/${baseJourney.id}`;
      if (!currentJourneyIds.has(key)) continue;
      const curProfile = currentCoverage.profiles.find(p => p.id === baseProfile.id);
      const curJourney = curProfile?.journeys.find(j => j.id === baseJourney.id);
      if (curJourney) {
        // Added assertions are compatible only if every original action remains
        // present in order, with its selector, value, and expectations intact.
        let retained = 0;
        for (const action of curJourney.actions) {
          if (isDeepStrictEqual(action, baseJourney.actions[retained])) retained++;
        }
        if (retained !== baseJourney.actions.length) {
          differences.push({
            kind: 'changed-action-coverage',
            journeyId: key,
            detail: 'An original action or assertion was removed, changed, or reordered.',
          });
        }
      }
      if (curJourney && curJourney.steps !== baseJourney.steps) {
        differences.push({
          kind: 'step-count-change',
          journeyId: key,
          baselineSteps: baseJourney.steps,
          currentSteps: curJourney.steps,
          detail: `Step count changed from ${baseJourney.steps} to ${curJourney.steps}.`,
        });
      }
      if (curJourney && curJourney.checkpoints !== baseJourney.checkpoints) {
        differences.push({
          kind: 'checkpoint-count-change',
          journeyId: key,
          baselineCheckpoints: baseJourney.checkpoints,
          currentCheckpoints: curJourney.checkpoints,
          detail: `Checkpoint count changed from ${baseJourney.checkpoints} to ${curJourney.checkpoints}.`,
        });
      }
    }
  }

  return differences;
}

async function captureBaseline() {
  const baselinePkgPath = join(BASELINE_ROOT, 'package.json');
  const currentPkgPath = join(CURRENT_ROOT, 'package.json');

  if (!existsSync(baselinePkgPath)) {
    console.error(`Baseline package.json not found at ${BASELINE_ROOT}. Cannot compare.`);
    process.exit(1);
  }

  const baselinePkg = readJsonSafe(baselinePkgPath);
  const currentPkg = readJsonSafe(currentPkgPath);

  if (!baselinePkg || !currentPkg) {
    console.error('Failed to read package.json from baseline or current.');
    process.exit(1);
  }

  // 1. Package metadata
  const baselineVersion = baselinePkg.version;
  const currentVersion = currentPkg.version;

  // 2. Source hashes
  const sourceHashes = {
    baselinePackageJson: hashFile(baselinePkgPath),
    currentPackageJson: hashFile(currentPkgPath),
  };

  // 3. Script comparison
  const scriptComparison = compareScripts(baselinePkg, currentPkg);

  // 4. Knowledge base file counts
  const baselineKbPath = join(BASELINE_ROOT, 'knowledge-base');
  const currentKbPath = join(CURRENT_ROOT, 'knowledge-base');
  const baselineKbFiles = existsSync(baselineKbPath) ? walk(baselineKbPath).map(f => relative(BASELINE_ROOT, f)) : [];
  const currentKbFiles = existsSync(currentKbPath) ? walk(currentKbPath).map(f => relative(CURRENT_ROOT, f)) : [];

  // 5. SceneStart journey comparison
  const sceneStartBenchmark = 'knowledge-base/benchmarks/scenestart';
  const baselineSceneStart = extractJourneyCoverage(BASELINE_ROOT, sceneStartBenchmark);
  const currentSceneStart = extractJourneyCoverage(CURRENT_ROOT, sceneStartBenchmark);
  const journeyDifferences = compareJourneyCoverage(baselineSceneStart, currentSceneStart);
  const benchmarks = ['aegisops', 'scenestart', 'azure-optimizer'].map(id => {
    const path = `knowledge-base/benchmarks/${id}`;
    const baseline = extractJourneyCoverage(BASELINE_ROOT, path);
    const current = extractJourneyCoverage(CURRENT_ROOT, path);
    return { id, baseline, current,
      differences: baseline.journeysFileExists ? compareJourneyCoverage(baseline, current) : [],
      scope: baseline.journeysFileExists ? 'packaged-contract-retention' : 'not-in-baseline-artifact',
    };
  });

  // 6. Determine pass/fail
  const missingCoverage = benchmarks.flatMap(benchmark => benchmark.differences).filter(d =>
    d.kind === 'missing-coverage' || d.kind === 'changed-action-coverage');
  const limitations = [];

  if (baselineVersion !== '2.0.0') {
    limitations.push('Baseline package version is not 2.0.0; historical parity cannot be established.');
  }
  if (!baselineSceneStart.journeysFileExists || baselineSceneStart.totalJourneys === 0) {
    limitations.push('Baseline SceneStart journeys.json not found; journey comparison is unsupported.');
  }
  if (!baselineSceneStart.interactionFileExists && currentSceneStart.interactionFileExists) {
    limitations.push('Interaction journeys file exists in current but not in baseline; comparison covers only main journeys.');
  }
  if (scriptComparison.removed.length > 0) {
    limitations.push(`${scriptComparison.removed.length} scripts present in baseline were removed in current version.`);
  }

  let status = 'pass';
  if (baselineVersion !== '2.0.0' || !baselineSceneStart.journeysFileExists || baselineSceneStart.totalJourneys === 0) {
    status = 'unresolved';
  } else if (missingCoverage.length > 0) {
    status = 'fail';
  } else if (limitations.filter(l => l.includes('not found')).length > 0) {
    status = 'unresolved';
  } else if (limitations.length > 0) {
    status = 'pass-with-limitation';
  }

  const report = {
    version: '1.1',
    qualificationScope: 'packaged-contract-retention',
    scopeVersion: '1.0',
    scopeLimitations: ['Does not certify historical rendering, user preference, or unavailable interaction contracts.',
      'New current interaction contracts are additions, not evidence of historical behavior.'],
    benchmarks,
    generatedAt: new Date().toISOString(),
    baselineVersion,
    currentVersion,
    baselineRoot: '<private>',
    sourceHashes,
    comparedPaths: {
      packageJson: true,
      knowledgeBase: true,
      sceneStartBenchmark: baselineSceneStart.journeysFileExists,
    },
    scriptComparison,
    knowledgeBase: {
      baselineFileCount: baselineKbFiles.length,
      currentFileCount: currentKbFiles.length,
    },
    sceneStart: {
      baseline: {
        totalJourneys: baselineSceneStart.totalJourneys,
        totalSteps: baselineSceneStart.totalSteps,
        totalCheckpoints: baselineSceneStart.totalCheckpoints,
        totalInteractionJourneys: baselineSceneStart.totalInteractionJourneys,
        totalInteractionSteps: baselineSceneStart.totalInteractionSteps,
      },
      current: {
        totalJourneys: currentSceneStart.totalJourneys,
        totalSteps: currentSceneStart.totalSteps,
        totalCheckpoints: currentSceneStart.totalCheckpoints,
        totalInteractionJourneys: currentSceneStart.totalInteractionJourneys,
        totalInteractionSteps: currentSceneStart.totalInteractionSteps,
      },
      differences: journeyDifferences,
    },
    limitations,
    status,
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  const reportPath = join(OUTPUT_DIR, 'v7-baseline-report.json');
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    console.error(`Baseline comparison report written to ${reportPath}`);
    console.error(`Baseline: v${baselineVersion}, Current: v${currentVersion}`);
    console.error(`Journeys: ${baselineSceneStart.totalJourneys} (baseline) vs ${currentSceneStart.totalJourneys} (current)`);
    console.error(`Steps: ${baselineSceneStart.totalSteps} (baseline) vs ${currentSceneStart.totalSteps} (current)`);
    console.error(`Checkpoints: ${baselineSceneStart.totalCheckpoints} (baseline) vs ${currentSceneStart.totalCheckpoints} (current)`);
    console.error(`Differences: ${journeyDifferences.length}`);
    console.error(`Limitations: ${limitations.length}`);
    console.error(`Result: ${status.toUpperCase()}`);
    if (status === 'unresolved') {
      console.error('Cannot claim "no steps were lost" because baseline evidence is unavailable.');
    } else if (status === 'pass') {
      console.error('Comparison proves no main-journey steps were lost.');
    } else if (status === 'pass-with-limitation') {
      console.error('Main journeys match, but full parity remains limited by unavailable baseline interaction-journey evidence.');
    }
  }

  process.exit(status === 'pass' || (packagedScope && status === 'pass-with-limitation'
    && missingCoverage.length === 0 && scriptComparison.removed.length === 0) ? 0 : 1);
}

captureBaseline();
