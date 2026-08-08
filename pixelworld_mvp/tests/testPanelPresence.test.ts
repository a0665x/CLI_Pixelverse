import { describe, expect, it } from 'vitest';
import { formatAgentPresence } from '../src/ui/TestPanel';
import type { WorldBuilding } from '../src/world/types';

const buildings = [
  { id: 'build-workshop', label: 'Build Workshop' },
  { id: 'signal-station', label: 'Signal Station' },
] as WorldBuilding[];

describe('Agent presence readout', () => {
  it('shows outdoor Agents plainly', () => {
    expect(formatAgentPresence({ kind: 'outside' }, buildings)).toBe('Outdoor');
  });

  it('shows the human building name for an inside Agent', () => {
    expect(formatAgentPresence({
      kind: 'inside',
      buildingId: 'signal-station',
      threshold: { x: 33, y: 6 },
    }, buildings)).toBe('Inside Signal Station');
  });

  it('falls back to the stable building id when metadata is unavailable', () => {
    expect(formatAgentPresence({
      kind: 'inside',
      buildingId: 'future-room',
      threshold: { x: 1, y: 1 },
    }, buildings)).toBe('Inside future-room');
  });
});
