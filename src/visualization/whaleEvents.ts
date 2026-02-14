export interface WhaleRipple {
  position: [number, number, number];
  color: [number, number, number];
}

const pending: WhaleRipple[] = [];

export function queueWhaleRipple(ripple: WhaleRipple): void {
  pending.push(ripple);
}

export function drainWhaleRipples(): WhaleRipple[] {
  return pending.splice(0, pending.length);
}
