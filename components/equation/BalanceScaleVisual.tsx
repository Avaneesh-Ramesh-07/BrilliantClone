"use client";

interface BalanceScaleVisualProps {
  leftValue: number;
  rightValue: number;
  leftLabel: string;
  rightLabel: string;
  balanced?: boolean;
}

export function BalanceScaleVisual({
  leftValue,
  rightValue,
  leftLabel,
  rightLabel,
  balanced,
}: BalanceScaleVisualProps) {
  const diff = rightValue - leftValue;
  const tilt = Math.max(-16, Math.min(16, diff * 1.8));

  return (
    <div className="mx-auto w-full max-w-[240px]">
      <svg
        viewBox="0 110 280 120"
        className="w-full"
        aria-label={`Balance scale: left ${leftValue}, right ${rightValue}`}
      >
        {/* Stand */}
        <polygon
          points="140,185 120,200 160,200"
          fill="var(--color-muted)"
        />
        <rect
          x="136"
          y="155"
          width="8"
          height="30"
          rx="2"
          fill="var(--color-muted)"
        />

        {/* Beam + pans, rotate around fulcrum */}
        <g transform={`rotate(${tilt}, 140, 155)`}>
          <rect
            x="40"
            y="150"
            width="200"
            height="6"
            rx="3"
            fill="var(--color-text)"
          />
          {/* Left pan */}
          <line x1="55" y1="156" x2="55" y2="175" stroke="var(--color-muted)" strokeWidth="2" />
          <rect
            x="25"
            y="175"
            width="60"
            height="8"
            rx="4"
            fill={balanced ? "var(--color-success)" : "var(--color-primary-light)"}
            stroke={balanced ? "var(--color-success)" : "var(--color-primary)"}
            strokeWidth="1.5"
          />
          <text
            x="55"
            y="198"
            textAnchor="middle"
            fill="var(--color-text)"
            fontSize="13"
            fontFamily="var(--font-dm-mono)"
          >
            {leftLabel} = {leftValue}
          </text>
          {/* Right pan */}
          <line x1="225" y1="156" x2="225" y2="175" stroke="var(--color-muted)" strokeWidth="2" />
          <rect
            x="195"
            y="175"
            width="60"
            height="8"
            rx="4"
            fill={balanced ? "var(--color-success)" : "var(--color-primary-light)"}
            stroke={balanced ? "var(--color-success)" : "var(--color-primary)"}
            strokeWidth="1.5"
          />
          <text
            x="225"
            y="198"
            textAnchor="middle"
            fill="var(--color-text)"
            fontSize="13"
            fontFamily="var(--font-dm-mono)"
          >
            {rightLabel}
          </text>
        </g>

        {/* Fulcrum */}
        <circle cx="140" cy="155" r="6" fill="var(--color-primary)" />
      </svg>

      {!balanced && diff !== 0 && (
        <p className="mt-2 text-center text-body text-muted">
          {diff > 0
            ? "The right side is heavier. Try a larger x."
            : "The left side is heavier. Try a smaller x."}
        </p>
      )}
      {balanced && (
        <p className="mt-2 text-center text-body text-success">
          Balanced! Both sides are equal.
        </p>
      )}
    </div>
  );
}
