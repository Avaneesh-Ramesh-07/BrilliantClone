/**
 * Samples a function y = fn(x) across [xMin, xMax] and returns SVG polyline
 * point-strings BROKEN into separate segments wherever the curve leaves the
 * vertical view [yMin, yMax]. This avoids the flat horizontal line you get from
 * clamping out-of-bounds y-values: instead the curve simply exits the top/bottom
 * edge and reappears when it comes back into view.
 *
 * Each returned string is a `points` value for one `<polyline>`. Render them as
 * several polylines (e.g. `segments.map((pts, i) => <polyline key={i} ... />)`).
 *
 * @param sx maps a data x to an SVG x coordinate
 * @param sy maps a data y to an SVG y coordinate
 */
export function curveSegments(
  fn: (x: number) => number,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  sx: (x: number) => number,
  sy: (y: number) => number,
  samples: number = 160
): string[] {
  const segments: string[] = [];
  let current: string[] = [];
  const clamp = (y: number) => Math.max(yMin, Math.min(yMax, y));

  let prev: { x: number; y: number; inside: boolean } | null = null;

  for (let i = 0; i <= samples; i++) {
    const x = xMin + ((xMax - xMin) * i) / samples;
    const y = fn(x);
    const inside = Number.isFinite(y) && y >= yMin && y <= yMax;

    if (inside) {
      // Entering from out-of-bounds: anchor to the edge so the curve visibly
      // runs up to (and exits) the top/bottom rather than starting mid-air.
      if (prev && !prev.inside && Number.isFinite(prev.y)) {
        current.push(`${sx(prev.x)},${sy(clamp(prev.y))}`);
      }
      current.push(`${sx(x)},${sy(y)}`);
    } else {
      // Leaving the view: anchor the last point to the edge, then end the run.
      if (prev && prev.inside) {
        current.push(`${sx(x)},${sy(clamp(y))}`);
      }
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
    }

    prev = { x, y, inside };
  }

  if (current.length > 1) segments.push(current.join(" "));
  return segments;
}
