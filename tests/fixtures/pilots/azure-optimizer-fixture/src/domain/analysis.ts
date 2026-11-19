export type Finding = {
  resource: string;
  observation: string;
  recommendation: string;
  monthlySavings: number;
  validation: string;
};

// Independently authored synthetic records, never telemetry from an Azure subscription.
export const demonstrationFindings: readonly Finding[] = [
  { resource: 'vm-prod-17', observation: 'CPU average 8%, peak 18% in the fictional sample.',
    recommendation: 'Evaluate a smaller virtual machine size.', monthlySavings: 820,
    validation: 'Load-test the smaller size outside production and compare latency and peak utilization.' },
  { resource: 'disk-demo-04', observation: 'The fictional inventory marks this disk as unattached.',
    recommendation: 'Review retention before removing the disk.', monthlySavings: 300,
    validation: 'Confirm ownership, backup recovery and retention requirements before deletion.' },
  { resource: 'vm-dev-03', observation: 'The fictional development workload is idle outside working hours.',
    recommendation: 'Evaluate a scheduled shutdown.', monthlySavings: 120,
    validation: 'Agree an operating schedule and test restart dependencies with the workload owner.' },
];

export function analyzeDemonstration(mode: string): { findings: Finding[]; monthlySavings: number } {
  if (mode !== 'demo') throw new Error('Analysis requires the explicitly selected demonstration dataset.');
  const findings = demonstrationFindings.map(finding => ({ ...finding })).sort((a, b) => b.monthlySavings - a.monthlySavings);
  return { findings, monthlySavings: findings.reduce((total, finding) => total + finding.monthlySavings, 0) };
}
