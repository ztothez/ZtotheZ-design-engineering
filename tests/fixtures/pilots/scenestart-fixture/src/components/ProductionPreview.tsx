import { useEffect, useRef, useState } from 'react';
import { drawProduction, type Production } from '../domain/production';

export function ProductionPreview({ project, playing, restart = 0 }: { project: Production; playing: boolean; restart?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const elapsed = useRef(0);
  const [scene, setScene] = useState(0);
  useEffect(() => { elapsed.current = 0; }, [restart]);
  useEffect(() => {
    let request = 0; let previous = 0; let lastScene = -1;
    const total = project.scenes.reduce((sum, item) => sum + item.duration, 0);
    function frame(now: number) {
      if (playing && previous) elapsed.current = Math.min(total, elapsed.current + (now - previous) / 1000);
      previous = now;
      let offset = 0; let index = project.scenes.length - 1;
      for (let i = 0; i < project.scenes.length; i += 1) {
        if (elapsed.current < offset + project.scenes[i]!.duration) { index = i; break; }
        offset += project.scenes[i]!.duration;
      }
      if (index !== lastScene) { lastScene = index; setScene(index); }
      const activeScene = project.scenes[index];
      if (canvas.current && activeScene) drawProduction(canvas.current, activeScene.title,
        matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : elapsed.current);
      request = requestAnimationFrame(frame);
    }
    request = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(request);
  }, [project, playing]);
  return <div><canvas className="production-preview" ref={canvas} width={800} height={450} aria-label="Timed production preview" />
    <p aria-live="polite">Scene {scene + 1} of {project.scenes.length}: {project.scenes[scene]?.title}</p></div>;
}
