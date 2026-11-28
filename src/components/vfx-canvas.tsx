import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { MotionMode } from '@/lib/types/stash';
import { vfxEngine } from '@/lib/vfx/engine';

interface VfxCanvasProps {
  motionMode: MotionMode;
  dropDust?: boolean;
  dropFissures?: boolean;
}

function MountedVfxCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const node = canvasRef.current;
    if (!node) return;
    return vfxEngine.mount(node);
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <canvas
      ref={canvasRef}
      tabIndex={-1}
      className="pointer-events-none fixed inset-0 z-[9999]"
    />,
    document.body,
  );
}

/**
 * Thin fixed 2D `<canvas>` overlay portaled directly into `document.body` so it
 * stays immune to workspace `transform` punches and always stacks cleanly above
 * Radix Dialogs (`z-50`) for Settings previews. Unmounts completely outside
 * `Arcade` to release GPU canvas memory, observers, and resize listeners.
 */
export function VfxCanvas({
  motionMode,
  dropDust = true,
  dropFissures = true,
}: VfxCanvasProps) {
  useEffect(() => {
    vfxEngine.setConfig({ motionMode, dropDust, dropFissures });
  }, [motionMode, dropDust, dropFissures]);

  if (motionMode !== 'arcade') return null;
  return <MountedVfxCanvas />;
}
