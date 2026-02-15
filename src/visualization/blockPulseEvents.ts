export interface BlockPulseEvent {
  chainId: string;
  center: [number, number, number];
  color: [number, number, number];
}

// Supports multiple consumers: each gets their own copy of events
const queues: Map<string, BlockPulseEvent[]> = new Map();

function getQueue(consumerId: string): BlockPulseEvent[] {
  let q = queues.get(consumerId);
  if (!q) {
    q = [];
    queues.set(consumerId, q);
  }
  return q;
}

export function queueBlockPulse(event: BlockPulseEvent): void {
  // Push to all registered queues, and a default queue for new consumers
  for (const q of queues.values()) {
    q.push(event);
  }
  // Also push to a staging area for consumers that haven't registered yet
  staging.push(event);
}

const staging: BlockPulseEvent[] = [];

export function drainBlockPulses(consumerId: string): BlockPulseEvent[] {
  if (!queues.has(consumerId)) {
    // First call: register and return any staged events
    queues.set(consumerId, []);
    return staging.splice(0, staging.length);
  }
  const q = getQueue(consumerId);
  return q.splice(0, q.length);
}
