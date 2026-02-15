export interface WhaleEvent {
  position: [number, number, number];
  color: [number, number, number];
  poolIndex: number;
  value: number;
}

const pending: WhaleEvent[] = [];

export function queueWhaleEvent(event: WhaleEvent): void {
  pending.push(event);
}

export function drainWhaleEvents(): WhaleEvent[] {
  return pending.splice(0, pending.length);
}

// Keep backwards-compatible aliases
export type WhaleRipple = WhaleEvent;
export const queueWhaleRipple = queueWhaleEvent;
export const drainWhaleRipples = drainWhaleEvents;
