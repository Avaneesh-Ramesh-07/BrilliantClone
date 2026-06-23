import { Button } from "@/components/ui/Button";

interface HintButtonProps {
  hints: string[];
  hintsRevealed: number;
  onReveal: () => void;
  canReveal: boolean;
}

export function HintButton({
  hints,
  hintsRevealed,
  onReveal,
  canReveal,
}: HintButtonProps) {
  const noHints = hints.length === 0;
  const allRevealed = hintsRevealed >= hints.length;
  const locked = !canReveal && hintsRevealed === 0;
  const disabled = noHints || allRevealed || locked;

  const label = (() => {
    if (allRevealed && !noHints) return "No more hints";
    if (locked) return "Hint (available after a wrong answer)";
    return "Hint";
  })();

  return (
    <div className="flex flex-col gap-2">
      {hints.slice(0, hintsRevealed).map((hint, i) => (
        <p key={i} className="text-body text-muted">
          💡 {hint}
        </p>
      ))}
      <Button
        type="button"
        variant="ghost"
        onClick={onReveal}
        disabled={disabled}
        className="justify-start px-0"
      >
        {label}
      </Button>
    </div>
  );
}
