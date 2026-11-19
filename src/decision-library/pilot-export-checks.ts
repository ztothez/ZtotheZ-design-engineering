import type { RuntimeJourney } from '../runtime/types.js';

export const pilotExportPolicyVersion = '1.0';

/** Additional V7 assertions; the retained 2.0.0 journey contracts remain unchanged. */
export function withPilotExportChecks(product: string, journeys: RuntimeJourney[]): RuntimeJourney[] {
  return journeys.map(journey => ({ ...journey, steps: journey.steps.map(step => {
    if (step.action !== 'expectDownload') return step;
    if (product === 'aegisops' && step.filenameIncludes?.endsWith('.yml')) return {
      ...step, contentIncludes: ['fixture_technique: T1059.001', 'Non-deployable demonstration data'],
    };
    if (product !== 'scenestart') return step;
    if (step.filenameIncludes === 'scenestart-production.json') return {
      ...step, jsonAssertions: [{ path: 'version', value: 2 }, { path: 'handle', value: 'ZSCENE' }],
    };
    if (step.filenameIncludes === 'my-production.html') return {
      ...step, contentIncludes: ['<html', journey.steps.some(item => item.action === 'navigate' && item.value === '/workshop') ? 'NOVA' : 'ZSCENE'],
    };
    if (step.filenameIncludes === 'readme.txt') return { ...step, contentIncludes: ['Signal Arc', 'Interface planning assistance disclosed by the creator.'] };
    return step;
  }) }));
}
