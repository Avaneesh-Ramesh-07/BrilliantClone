import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function LandingPage() {
  return (
    // Full-bleed breakout: the root layout traps every page inside a 480px
    // centered column (max-w-app) with px-4 padding. left-1/2 + -mx-[50vw] +
    // w-screen pulls this element out to span the entire viewport width so the
    // split reaches both screen edges.
    <div className="relative left-1/2 right-1/2 -mx-[50vw] flex min-h-screen w-screen flex-col md:flex-row">
      {/* LEFT, the dojo brand (light) */}
      <section className="relative flex min-h-[40vh] w-full flex-col justify-center overflow-hidden bg-gradient-to-br from-primary-light via-bg to-surface px-8 py-16 md:min-h-screen md:w-1/2 md:px-14">
        {/* Soft indigo + red accent glows (kept light and airy) */}
        <div
          className="pointer-events-none absolute -left-24 top-1/4 h-96 w-96 rounded-full bg-primary/15 blur-[120px]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-error/10 blur-[110px]"
          aria-hidden="true"
        />

        {/* Torii gate + brush-stroke motif drawn faintly behind the brand */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]"
          viewBox="0 0 400 600"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          {/* Torii gate */}
          <g stroke="#3b5bdb" strokeWidth="3" strokeLinecap="round">
            <path d="M40 150 H360" />
            <path d="M60 180 H340" />
            <path d="M90 180 V520" />
            <path d="M310 180 V520" />
            <path d="M30 150 Q200 110 370 150" strokeWidth="5" />
          </g>
          {/* Brush-stroke path sweeping up like a climbing arc */}
          <path
            className="animate-line-draw"
            d="M-20 540 C 90 470, 70 360, 170 320 S 300 220, 350 110"
            stroke="#e03131"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>

        {/* Floating shuriken accent */}
        <div
          className="animate-hero-float pointer-events-none absolute right-8 top-12 select-none text-[44px] leading-none text-error/30 md:right-12 md:top-16 md:text-[64px]"
          aria-hidden="true"
        >
          ✦
        </div>

        <div className="relative z-10">
          <span className="text-label uppercase tracking-[0.3em] text-error">
            Enter the Dojo
          </span>
          <h1 className="font-heading mt-3 text-[56px] font-bold leading-[0.95] tracking-tight text-text sm:text-[72px] md:text-[88px]">
            Algebra
            <br />
            <span className="text-error">Dojo</span>
          </h1>
          <div className="mt-6 h-1 w-24 rounded-full bg-gradient-to-r from-error to-transparent" />
          <p className="mt-6 max-w-md text-body text-muted">
            Train like a ninja and master algebra by solving equations
            hands-on: drag terms, strike down for{" "}
            <span className="font-math text-primary">x</span>, and earn your
            black belt.
          </p>
        </div>
      </section>

      {/* RIGHT, light math backdrop + auth card */}
      <section className="relative flex w-full flex-1 items-center justify-center overflow-hidden bg-bg px-6 py-16 md:w-1/2 md:px-10">
        {/* Math imagery backdrop: faint SVG/CSS equations & a parabola grid.
            Hidden entirely on phone (below md) for a clean single-column layout;
            the full animated backdrop returns at md and up. */}
        <div className="pointer-events-none absolute inset-0 hidden md:block" aria-hidden="true">
          {/* Coordinate grid + parabola */}
          <svg
            className="absolute -right-10 top-1/2 h-[420px] w-[420px] -translate-y-1/2 text-primary/10"
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
              className="text-primary/30"
              fill="none"
            />
          </svg>

          {/* Scattered equations, rotated and faint, each gently floats on its
              own staggered cycle so the backdrop feels dynamic. Outer div holds
              position, middle div floats (animate-hero-float), inner keeps the
              rotation so the float doesn't clobber the transform. */}
          <div className="absolute left-6 top-10">
            <div className="animate-hero-float" style={{ animationDuration: "7s", animationDelay: "0s" }}>
              <div className="font-math -rotate-6 text-[34px] text-text/[0.06]">
                x = (-b ± √(b² − 4ac)) / 2a
              </div>
            </div>
          </div>
          <div className="absolute right-8 top-24">
            <div className="animate-hero-float" style={{ animationDuration: "5.5s", animationDelay: "-1.5s" }}>
              <div className="font-equation rotate-3 text-[22px] text-primary/[0.16]">
                3x + 5 = 20
              </div>
            </div>
          </div>
          <div className="absolute left-10 top-1/3">
            <div className="animate-hero-float" style={{ animationDuration: "8s", animationDelay: "-3s" }}>
              <div className="font-math rotate-2 text-[40px] text-text/[0.05]">
                (x + 3)(x − 2)
              </div>
            </div>
          </div>
          <div className="absolute bottom-28 left-4">
            <div className="animate-hero-float" style={{ animationDuration: "6.5s", animationDelay: "-2s" }}>
              <div className="font-equation -rotate-3 text-[20px] text-error/[0.16]">
                f(x) = x² + 2x − 1
              </div>
            </div>
          </div>
          <div className="absolute bottom-16 right-10">
            <div className="animate-hero-float" style={{ animationDuration: "9s", animationDelay: "-4s" }}>
              <div className="font-math rotate-6 text-[30px] text-text/[0.06]">
                a/b + c/d
              </div>
            </div>
          </div>
          <div className="absolute right-1/4 top-6">
            <div className="animate-hero-float" style={{ animationDuration: "6s", animationDelay: "-0.8s" }}>
              <div className="font-math rotate-12 text-[26px] text-text/[0.05]">
                ∑ aₙxⁿ
              </div>
            </div>
          </div>
          <div className="absolute bottom-1/3 right-6">
            <div className="animate-hero-float" style={{ animationDuration: "7.5s", animationDelay: "-2.6s" }}>
              <div className="font-equation -rotate-6 text-[18px] text-primary/[0.14]">
                y = mx + b
              </div>
            </div>
          </div>
        </div>

        {/* Auth card, white card-pop with a thin indigo→red accent top bar */}
        <div className="card-pop relative z-10 w-full max-w-sm overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-primary via-accent-purple to-error" />
          <div className="p-8">
            <h2 className="font-heading text-heading-lg text-text">
              Begin your training
            </h2>
            <p className="mt-2 text-body text-muted">
              Create an account or log in to continue your path to mastering{" "}
              <span className="font-math text-primary">x</span>.
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
          </div>
        </div>
      </section>
    </div>
  );
}
