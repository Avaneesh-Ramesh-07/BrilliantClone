/**
 * Dependency-free canvas confetti. Avoids pulling in an external library
 * (and the blocked npm install). Each burst creates a short-lived, full-screen
 * canvas overlay that cleans itself up when the animation finishes.
 */

interface ConfettiOptions {
  particleCount?: number;
  /** Cone width in degrees around the upward direction. */
  spread?: number;
  startVelocity?: number;
  /** Origin as fractions of the viewport (0..1). */
  origin?: { x?: number; y?: number };
  colors?: string[];
  gravity?: number;
  scalar?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  w: number;
  h: number;
  color: string;
  life: number;
  decay: number;
}

const DEFAULT_COLORS = [
  "#3b5bdb",
  "#2f9e44",
  "#e03131",
  "#f08c00",
  "#ae3ec9",
  "#1098ad",
];

export function fireConfetti(options: ConfettiOptions = {}): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const {
    particleCount = 40,
    spread = 70,
    startVelocity = 30,
    origin = { x: 0.5, y: 0.5 },
    colors = DEFAULT_COLORS,
    gravity = 0.32,
    scalar = 1,
  } = options;

  const dpr = window.devicePixelRatio || 1;
  const W = window.innerWidth;
  const H = window.innerHeight;

  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;";
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }
  ctx.scale(dpr, dpr);

  const ox = (origin.x ?? 0.5) * W;
  const oy = (origin.y ?? 0.5) * H;

  const particles: Particle[] = [];
  const baseAngle = -90; // straight up in degrees
  for (let i = 0; i < particleCount; i++) {
    const angleDeg = baseAngle + (Math.random() - 0.5) * spread;
    const angle = (angleDeg * Math.PI) / 180;
    const velocity = startVelocity * (0.5 + Math.random() * 0.5);
    particles.push({
      x: ox,
      y: oy,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.3,
      w: (6 + Math.random() * 4) * scalar,
      h: (10 + Math.random() * 6) * scalar,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
      decay: 0.008 + Math.random() * 0.01,
    });
  }

  let frame = 0;
  const maxFrames = 260;

  function tick() {
    if (!ctx) return;
    frame++;
    ctx.clearRect(0, 0, W, H);
    let alive = false;
    for (const p of particles) {
      if (p.life <= 0) continue;
      p.vy += gravity;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vrot;
      p.life -= p.decay;
      if (p.life > 0 && p.y < H + 24) alive = true;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (alive && frame < maxFrames) {
      requestAnimationFrame(tick);
    } else {
      canvas.remove();
    }
  }

  requestAnimationFrame(tick);
}

/** A celebratory multi-burst for finishing a lesson. */
export function fireBigConfetti(): void {
  fireConfetti({
    particleCount: 90,
    spread: 100,
    startVelocity: 48,
    origin: { x: 0.5, y: 0.45 },
    scalar: 1.2,
  });
  window.setTimeout(
    () =>
      fireConfetti({
        particleCount: 70,
        spread: 120,
        startVelocity: 42,
        origin: { x: 0.2, y: 0.55 },
      }),
    180
  );
  window.setTimeout(
    () =>
      fireConfetti({
        particleCount: 70,
        spread: 120,
        startVelocity: 42,
        origin: { x: 0.8, y: 0.55 },
      }),
    340
  );
}
