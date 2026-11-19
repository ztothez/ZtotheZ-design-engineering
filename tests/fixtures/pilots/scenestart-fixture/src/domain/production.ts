export type Production = {
  version: 2;
  handle: string;
  concept: string;
  title: string;
  scenes: { title: string; duration: number }[];
};

export const projectKey = 'ztde.scenestart.production.v2';

export function createProduction(handle = ''): Production {
  return { version: 2, handle, concept: 'Editable starter production', title: 'Opening', scenes: [
    { title: 'Opening', duration: 6 }, { title: 'Build', duration: 8 }, { title: 'Ending', duration: 6 },
  ] };
}

export function parseProduction(text: string): Production {
  if (new TextEncoder().encode(text).length > 65536) throw new Error('Project exceeds 64 KB');
  const value: unknown = JSON.parse(text);
  const record = (item: unknown): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item);
  const boundedText = (item: unknown, max: number): item is string => typeof item === 'string' && item.length <= max;
  if (!record(value) || value.version !== 2 || !boundedText(value.handle, 8)
    || !boundedText(value.concept, 500) || !boundedText(value.title, 120)
    || !Array.isArray(value.scenes) || value.scenes.length < 3 || value.scenes.length > 8) throw new Error('Invalid project');
  const scenes = value.scenes.map(scene => {
    if (!record(scene) || !boundedText(scene.title, 120) || typeof scene.duration !== 'number'
      || !Number.isFinite(scene.duration) || scene.duration < 1 || scene.duration > 60) throw new Error('Invalid scene');
    return { title: scene.title, duration: scene.duration };
  });
  return { version: 2, handle: value.handle, concept: value.concept, title: value.title, scenes };
}

export function loadProduction(): Production {
  try {
    const saved = localStorage.getItem(projectKey);
    if (saved) return parseProduction(saved);
    return createProduction((localStorage.getItem('workshopHandle') ?? '').slice(0, 8));
  } catch { return createProduction(); }
}

export function downloadText(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Self-contained so the same renderer can run in the local preview and offline export.
export function drawProduction(canvas: HTMLCanvasElement, title: string, seconds: number) {
  const context = canvas.getContext('2d');
  if (!context) return;
  context.fillStyle = '#121619'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#65e2c1'; context.lineWidth = 2;
  for (let line = 0; line < 9; line += 1) {
    context.beginPath();
    for (let x = 0; x <= canvas.width; x += 8) {
      const y = canvas.height / 2 + Math.sin(x / 65 + seconds + line / 3) * (25 + line * 7);
      if (x === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.stroke();
  }
  context.fillStyle = '#ffffff'; context.font = '24px sans-serif';
  context.fillText(title, 16, 36, canvas.width - 32);
}

export function exportProduction(project: Production): string {
  const validated = parseProduction(JSON.stringify(project));
  const data = JSON.stringify(validated).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline production</title>
<style>body{margin:0;padding:16px;font:16px sans-serif;background:#121619;color:white}main{max-width:800px;margin:auto}canvas{width:100%;aspect-ratio:16/9}button{min-height:44px;padding:8px 16px;margin:4px}button:focus-visible{outline:3px solid #65e2c1}h1,p{overflow-wrap:anywhere}</style></head>
<body><main><h1 id="title"></h1><p id="credit"></p><p id="concept"></p><canvas width="800" height="450" aria-label="Timed production preview"></canvas>
<p id="status" role="status"></p><button id="play">Play</button><button id="restart">Restart</button><p>Editable starter visuals. No originality or release certification is claimed.</p></main>
<script id="project" type="application/json">${data}</script>
<script>
const project=JSON.parse(document.getElementById('project').textContent);
document.getElementById('title').textContent=project.title;
document.getElementById('credit').textContent=project.handle;
document.getElementById('concept').textContent=project.concept;
const canvas=document.querySelector('canvas'),status=document.getElementById('status'),play=document.getElementById('play');
const draw=${drawProduction.toString()};
let elapsed=0,last=0,playing=false,current=-1;
const total=project.scenes.reduce((sum,scene)=>sum+scene.duration,0);
function frame(now){if(playing){elapsed=Math.min(total,elapsed+(last?(now-last)/1000:0));if(elapsed===total){playing=false;play.textContent='Play';}}last=now;
let offset=0,index=project.scenes.length-1;for(let i=0;i<project.scenes.length;i++){if(elapsed<offset+project.scenes[i].duration){index=i;break;}offset+=project.scenes[i].duration;}
if(index!==current){current=index;status.textContent=(index+1)+' / '+project.scenes.length+': '+project.scenes[index].title;}
draw(canvas,project.scenes[index].title,matchMedia('(prefers-reduced-motion: reduce)').matches?0:elapsed);requestAnimationFrame(frame);}
play.onclick=()=>{if(elapsed===total)elapsed=0;playing=!playing;play.textContent=playing?'Pause':'Play';};
document.getElementById('restart').onclick=()=>{elapsed=0;playing=true;play.textContent='Pause';};
document.addEventListener('keydown',event=>{if(event.key==='Escape'){playing=false;play.textContent='Play';}});
requestAnimationFrame(frame);
</script></body></html>`;
}
