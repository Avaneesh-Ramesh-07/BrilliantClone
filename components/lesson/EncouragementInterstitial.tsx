"use client";

import { Button } from "@/components/ui/Button";

// Rotating positive reinforcement messages. Each is paired with a softer line of
// subtext. The two arrays are independent in length; the engine just advances an
// index and we wrap with modulo, so they rotate at their own cadence.
const MESSAGES = [
  "Great job!",
  "Keep it up!",
  "You're on a roll!",
  "Nice work — keep going!",
  "Crushing it!",
  "Way to stick with it!",
];

const SUBTEXTS = [
  "You're making real progress.",
  "Every question gets you closer.",
  "Momentum looks good on you.",
  "Take a breath, then keep moving.",
  "Steady effort pays off.",
];

interface EncouragementInterstitialProps {
  /** Monotonic counter from the engine; rotates the message via modulo. */
  index: number;
  onContinue: () => void;
}

export function EncouragementInterstitial({
  index,
  onContinue,
}: EncouragementInterstitialProps) {
  const message = MESSAGES[index % MESSAGES.length];
  const subtext = SUBTEXTS[index % SUBTEXTS.length];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/95 px-6 backdrop-blur">
      <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border border-border bg-surface px-6 py-10 text-center shadow-lg">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-primary-light text-primary">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-8 w-8"
            aria-hidden
          >
            <path
              d="M12 2l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L12 14.9 6.9 17.8l1.2-5.6L4 8.4l5.6-.6L12 2z"
              fill="currentColor"
            />
          </svg>
        </div>
        <h2 className="font-heading text-heading-md text-text">{message}</h2>
        <p className="text-body text-muted">{subtext}</p>
        <Button type="button" fullWidth onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
