import fs from 'node:fs';
import path from 'node:path';

function compareJourneys(dir1, dir2) {
  const journeys1 = JSON.parse(fs.readFileSync(path.join(dir1, 'knowledge-base/benchmarks/scenestart/journeys.json'), 'utf8'));
  const journeys2 = JSON.parse(fs.readFileSync(path.join(dir2, 'knowledge-base/benchmarks/scenestart/journeys.json'), 'utf8'));

  let int1 = null;
  try {
    int1 = JSON.parse(fs.readFileSync(path.join(dir1, 'knowledge-base/benchmarks/scenestart/interaction-journeys.json'), 'utf8'));
  } catch (e) {}

  let int2 = null;
  try {
    int2 = JSON.parse(fs.readFileSync(path.join(dir2, 'knowledge-base/benchmarks/scenestart/interaction-journeys.json'), 'utf8'));
  } catch (e) {}

  console.log("=== V2.0.0 Journeys ===");
  journeys1.profiles.forEach(p => {
    p.journeys.forEach(j => {
      console.log(`  Profile: ${p.id}, Journey: ${j.id}, Steps: ${j.steps.length}`);
    });
  });
  if (int1) {
    int1.profiles.forEach(p => {
      p.journeys.forEach(j => {
        console.log(`  Profile: ${p.id}, Interaction Journey: ${j.id}, Steps: ${j.steps.length}`);
      });
    });
  } else {
    console.log("  No interaction journeys");
  }

  console.log("=== V2.0.5 Journeys ===");
  journeys2.profiles.forEach(p => {
    p.journeys.forEach(j => {
      console.log(`  Profile: ${p.id}, Journey: ${j.id}, Steps: ${j.steps.length}`);
    });
  });
  if (int2) {
    int2.profiles.forEach(p => {
      p.journeys.forEach(j => {
        console.log(`  Profile: ${p.id}, Interaction Journey: ${j.id}, Steps: ${j.steps.length}`);
      });
    });
  } else {
    console.log("  No interaction journeys");
  }
}

compareJourneys('.ztothez-design-runtime/v7-baseline/v204/package', '.');
