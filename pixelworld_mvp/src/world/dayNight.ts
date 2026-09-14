export const DAY_LENGTH_MS = 60 * 60 * 1000;
/** UTC-anchored cycle: dawn :00, noon :15, dusk :30, midnight :45. */
export function dayNightAt(timestamp: number) {
  const phase = ((timestamp % DAY_LENGTH_MS) + DAY_LENGTH_MS) % DAY_LENGTH_MS / DAY_LENGTH_MS;
  const elevation = Math.sin(phase * Math.PI * 2);
  const daylight = Math.max(0, Math.min(1, (elevation + .12) / .42));
  return { phase, elevation, daylight, night: daylight < .2, hour: (6 + phase * 24) % 24 };
}
