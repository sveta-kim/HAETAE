// Swept AABB: first contact of a moving projectile, including thin obstacles
// and a projectile starting inside a solid. Returns fraction 0..1, or null.
export function sweep(shot, dx, dy, target) {
  let entry = 0, exit = 1;
  for (const [position, delta, low, high] of [
    [shot.x, dx, target.x - shot.w, target.x + target.w],
    [shot.y, dy, target.y - shot.h, target.y + target.h],
  ]) {
    if (Math.abs(delta) < 1e-10) {
      if (position < low || position > high) return null;
    } else {
      const a = (low - position) / delta, b = (high - position) / delta;
      entry = Math.max(entry, Math.min(a, b));
      exit = Math.min(exit, Math.max(a, b));
      if (entry > exit) return null;
    }
  }
  return entry;
}
