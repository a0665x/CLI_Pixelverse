import type { PlacementDiagnostic } from './interiorPlacement';

export type DragPhase = 'idle' | 'lifting' | 'dragging' | 'settling' | 'returning';

export interface DragPresentation {
  scale: number;
  alpha: number;
  tone: 'neutral' | 'valid' | 'invalid';
  durationMs: number;
}

export function dragPresentation(
  diagnostic: PlacementDiagnostic,
  phase: DragPhase,
  reducedMotion: boolean,
): DragPresentation {
  const invalid = diagnostic !== 'valid';
  return {
    scale: reducedMotion || phase === 'idle' ? 1 : phase === 'dragging' || phase === 'lifting' ? 1.035 : 1,
    alpha: phase === 'dragging' ? 0.94 : 1,
    tone: phase === 'idle' ? 'neutral' : invalid ? 'invalid' : 'valid',
    durationMs: reducedMotion ? 0 : phase === 'returning' ? 140 : 90,
  };
}
