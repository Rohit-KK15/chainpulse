export interface BridgeArcEvent {
  fromChain: string;
  toChain: string;
  fromCenter: [number, number, number];
  toCenter: [number, number, number];
  color: [number, number, number];
  value: number;
  timestamp: number;
}

const queue: BridgeArcEvent[] = [];

export function queueBridgeArc(event: BridgeArcEvent) {
  queue.push(event);
}

export function drainBridgeArcs(): BridgeArcEvent[] {
  if (queue.length === 0) return [];
  return queue.splice(0, queue.length);
}
