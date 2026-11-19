/**
 * Computational geometry for seat maps, following docs/map-format.md sections 3.1 and 5.
 * Rings are implicitly closed (the first point is not repeated at the end) and may
 * have either winding. Shared by the structural validator (self-intersections -> 400)
 * and the business-rule validator (containment and overlaps -> 422).
 */
import type { Point } from '../../maps/mapFormat';

export const EPSILON = 1e-9;

export function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

export function edgesOf(ring: Point[]): [Point, Point][] {
  return ring.map((point, index) => [point, ring[(index + 1) % ring.length]]);
}

export function onSegment(p: Point, a: Point, b: Point): boolean {
  return Math.abs(cross(a, b, p)) < EPSILON
    && p.x >= Math.min(a.x, b.x) - EPSILON && p.x <= Math.max(a.x, b.x) + EPSILON
    && p.y >= Math.min(a.y, b.y) - EPSILON && p.y <= Math.max(a.y, b.y) + EPSILON;
}

export function onBoundary(p: Point, ring: Point[]): boolean {
  return edgesOf(ring).some(([a, b]) => onSegment(p, a, b));
}

/** Ray casting; points on the boundary are explicitly not strictly inside. */
export function strictlyInside(p: Point, ring: Point[]): boolean {
  if (onBoundary(p, ring)) return false;
  let inside = false;
  for (const [a, b] of edgesOf(ring)) {
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function insideOrOnBoundary(p: Point, ring: Point[]): boolean {
  return onBoundary(p, ring) || strictlyInside(p, ring);
}

export function properlyCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return d1 * d2 < -EPSILON && d3 * d4 < -EPSILON;
}

/** True when two edges of the same ring that do not share a vertex cross each other. */
export function isSimplePolygon(ring: Point[]): boolean {
  const edges = edgesOf(ring);
  for (let i = 0; i < edges.length; i += 1) {
    for (let j = i + 1; j < edges.length; j += 1) {
      const adjacent = j === i + 1 || (i === 0 && j === edges.length - 1);
      if (adjacent) continue;
      const [a, b] = edges[i];
      const [c, d] = edges[j];
      if (properlyCross(a, b, c, d)) return false;
    }
  }
  return true;
}

export function boundingBox(ring: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  return ring.reduce(
    (box, point) => ({
      minX: Math.min(box.minX, point.x),
      maxX: Math.max(box.maxX, point.x),
      minY: Math.min(box.minY, point.y),
      maxY: Math.max(box.maxY, point.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
}

export function boxesOverlap(
  first: { minX: number; maxX: number; minY: number; maxY: number },
  second: { minX: number; maxX: number; minY: number; maxY: number }
): boolean {
  return first.minX <= second.maxX + EPSILON && second.minX <= first.maxX + EPSILON
    && first.minY <= second.maxY + EPSILON && second.minY <= first.maxY + EPSILON;
}

/** Interiors intersect; shared edges or vertices do not count (docs/map-format.md R6b). */
export function outlinesOverlap(first: Point[], second: Point[]): boolean {
  if (!boxesOverlap(boundingBox(first), boundingBox(second))) return false;
  const probes = (ring: Point[]) => [
    ...ring,
    ...edgesOf(ring).map(([a, b]) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })),
  ];
  return edgesOf(first).some(([a, b]) => edgesOf(second).some(([c, d]) => properlyCross(a, b, c, d)))
    || probes(first).some((p) => strictlyInside(p, second))
    || probes(second).some((p) => strictlyInside(p, first));
}
