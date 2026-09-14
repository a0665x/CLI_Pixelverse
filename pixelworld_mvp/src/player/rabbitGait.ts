export type RabbitGait='walk'|'hop'|'bound';
export const GAIT_SPEED={walk:1.8,hop:3.4,bound:5.6} as const;
export const GAIT_FREQUENCY={walk:3.2,hop:3.6,bound:4.2} as const;
export const RABBIT_SCALE=.43;
export const nextRabbitGait=(gait:RabbitGait):RabbitGait=>gait==='walk'?'hop':gait==='hop'?'bound':'walk';

// Keep limb reach bounded at arcade traversal speeds.
export const GAIT_STRIDE={walk:.25,hop:.29,bound:.34} as const;
