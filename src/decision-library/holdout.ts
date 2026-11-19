import { createHash } from 'node:crypto';
import { parse } from 'yaml';
import { portfolioRegistrySchema } from '../portfolio/schema.js';
import { portfolioBenchmarkReportSchema } from '../portfolio/run-schema.js';
import { readBoundedEvidence, evaluateBoundObservations } from './observations.js';
import { DecisionLibrary } from './library.js';

export async function evaluatePrivateHoldout(options: {
  registryRoot: string; registryPath: string; evidenceRoot: string; reportPath: string;
  library: DecisionLibrary; bundles?: Record<string, string>;
}) {
  const registryBytes = await readBoundedEvidence(options.registryRoot, options.registryPath);
  const registry = portfolioRegistrySchema.parse(parse(registryBytes.toString('utf8')));
  const reportBytes = await readBoundedEvidence(options.evidenceRoot, options.reportPath);
  const report = portfolioBenchmarkReportSchema.parse(JSON.parse(reportBytes.toString('utf8')));
  const authorized = registry.projects.filter(project => project.enabled && project.cohort === 'holdout'
    && ['first-party', 'client-authorized'].includes(project.ownership));
  if (!authorized.length || report.cohort !== 'holdout' || report.registryId !== registry.id
    || report.registryDigest !== createHash('sha256').update(registryBytes).digest('hex')) throw new Error('Holdout registry binding is missing or stale');
  if (report.projects.length !== authorized.length || authorized.some(project => !report.projects.some(item => item.projectId === project.id))) {
    throw new Error('Holdout report does not cover the authorized cohort');
  }
  const results = [];
  for (const project of report.projects) {
    if (project.cohort !== 'holdout') throw new Error('Development evidence cannot qualify the holdout');
    const unsafe = ['source-mutation', 'unsafe-configuration'].includes(project.status);
    let decision: Awaited<ReturnType<typeof evaluateBoundObservations>> | undefined;
    const bundle = options.bundles?.[project.projectId];
    if (bundle && project.sourceDigest && !unsafe) decision = await evaluateBoundObservations({
      root: options.evidenceRoot, path: bundle, productId: project.projectId,
      sourceDigest: project.sourceDigest, library: options.library,
    });
    results.push({ projectId: project.projectId, sourceDigest: project.sourceDigest,
      status: unsafe ? 'fail' : decision?.status ?? 'unresolved',
      retainedStatus: project.status,
      supportedStages: project.stages.filter(stage => stage.status === 'passed').map(stage => stage.stage),
      unsupportedStages: project.stages.filter(stage => stage.status === 'unsupported').map(stage => stage.stage),
      missingRuleIds: decision?.missingRuleIds ?? options.library.getAllRules().map(rule => rule.id),
      ...(decision ? { decision } : {}),
    });
  }
  return { version: '1.0', visibility: 'private-local', executionPerformed: false,
    registryBound: true, reportSha256: createHash('sha256').update(reportBytes).digest('hex'),
    status: results.some(result => result.status === 'fail') ? 'fail'
      : results.every(result => result.status === 'pass') ? 'pass' : 'unresolved', results,
    limitations: ['Reads retained evidence only; does not execute or modify original projects.',
      'Passing source stages do not establish rendered usability or unobserved decision rules.'],
  };
}
