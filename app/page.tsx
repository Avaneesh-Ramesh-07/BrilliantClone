import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function LandingPage() {
  return (
    // Full-bleed breakout: the root layout traps every page inside a 480px
    // centered column (max-w-app) with px-4 padding. left-1/2 + -mx-[50vw] +
    // w-screen pulls this element out to span the entire viewport width so the
    // split reaches both screen edges.
    <div className="relative left-1/2 right-1/2 -mx-[50vw] flex min-h-screen w-screen flex-col md:flex-row">
      {/* LEFT — the brand */}
      <section className="relative flex min-h-[40vh] w-full flex-col justify-center overflow-hidden bg-gradient-to-br from-primary via-[#27347a] to-[#0b1020] px-8 py-16 md:min-h-screen md:w-1/2 md:px-14">
        {/* Animated "path" line motif drawn behind the brand */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.18]"
          viewBox="0 0 400 600"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <path
            className="animate-line-draw"
            d="M-20 520 C 80 460, 60 360, 160 320 S 300 220, 340 120 S 420 20, 460 -20"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="160" cy="320" r="5" fill="white" />
          <circle cx="340" cy="120" r="5" fill="white" />
        </svg>

        {/* Floating equation accent */}
        <div
          className="font-math animate-hero-float pointer-events-none absolute right-8 top-12 select-none text-[44px] leading-none text-white/20 md:right-12 md:top-16 md:text-[64px]"
          aria-hidden="true"
        >
          x = 2
        </div>

        <div className="relative z-10">
          <span className="text-label text-white/60">Master Algebra</span>
          <h1 className="font-heading mt-3 bg-gradient-to-r from-white via-white to-primary-light bg-clip-text text-[56px] font-bold leading-[0.95] tracking-tight text-transparent sm:text-[72px] md:text-[88px]">
            Algebra
            <br />
            Path
          </h1>
          <div className="mt-6 h-1 w-24 rounded-full bg-gradient-to-r from-white to-transparent" />
          <p className="mt-6 max-w-md text-body text-white/75">
            Learn algebra by solving equations hands-on — drag terms, find{" "}
            <span className="font-math text-white">x</span>, and build real
            understanding.
          </p>
        </div>
      </section>

      {/* RIGHT — math backdrop + auth card */}
      <section className="relative flex w-full flex-1 items-center justify-center overflow-hidden bg-bg px-6 py-16 md:w-1/2 md:px-10">
        {/* Math imagery backdrop: crisp SVG/CSS equations & a parabola grid */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {/* Coordinate grid + parabola */}
          <svg
            className="absolute -right-10 top-1/2 h-[420px] w-[420px] -translate-y-1/2 text-primary/15"
            viewBox="0 0 200 200"
            fill="none"
          >
            <g stroke="currentColor" strokeWidth="0.5">
              <path d="M0 100 H200 M100 0 V200" strokeWidth="1" />
              <path d="M0 20 H200 M0 40 H200 M0 60 H200 M0 80 H200 M0 120 H200 M0 140 H200 M0 160 H200 M0 180 H200" />
              <path d="M20 0 V200 M40 0 V200 M60 0 V200 M80 0 V200 M120 0 V200 M140 0 V200 M160 0 V200 M180 0 V200" />
            </g>
            <path
              d="M20 180 Q100 -40 180 180"
              stroke="currentColor"
              strokeWidth="2.5"
              className="text-primary/40"
              fill="none"
            />
          </svg>

          {/* Scattered equations, rotated and faint */}
          <div className="font-math absolute left-6 top-10 -rotate-6 text-[34px] text-text/[0.07]">
            x = (-b ± √(b² − 4ac)) / 2a
          </div>
          <div className="font-equation absolute right-8 top-24 rotate-3 text-[22px] text-text/[0.08]">
            3x + 5 = 20
          </div>
          <div className="font-math absolute left-10 top-1/3 rotate-2 text-[40px] text-text/[0.06]">
            (x + 3)(x − 2)
          </div>
          <div className="font-equation absolute bottom-28 left-4 -rotate-3 text-[20px] text-text/[0.08]">
            f(x) = x² + 2x − 1
          </div>
          <div className="font-math absolute bottom-16 right-10 rotate-6 text-[30px] text-text/[0.07]">
            a/b + c/d
          </div>
          <div className="font-math absolute right-1/4 top-6 rotate-12 text-[26px] text-text/[0.06]">
            ∑ aₙxⁿ
          </div>
          <div className="font-equation absolute bottom-1/3 right-6 -rotate-6 text-[18px] text-text/[0.07]">
            y = mx + b
          </div>
        </div>

        {/* Auth card */}
        <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border/70 bg-surface/80 p-8 shadow-xl backdrop-blur-md">
          <h2 className="font-heading text-heading-md text-text">
            Start learning today
          </h2>
          <p className="mt-2 text-body text-muted">
            Create an account or log in to pick up your path to mastering{" "}
            <span className="font-math text-text">x</span>.
          </p>
          <div className="mt-7 flex flex-col gap-3">
            <Link href="/signup">
              <Button fullWidth>Sign Up</Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary" fullWidth>
                Log In
              </Button>
            </Link>
          </div>
          <p className="mt-5 text-center text-label text-muted">
            No credit card · Free to start
          </p>
        </div>
      </section>
    </div>
  );
}
