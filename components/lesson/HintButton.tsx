import { Button } from "@/components/ui/Button";

interface HintButtonProps {
  hints: string[];
  hintsRevealed: number;
  onReveal: () => void;
}

export function HintButton({
  hints,
  hintsRevealed,
  onReveal,
}: HintButtonProps) {
  const disabled = hintsRevealed >= hints.length || hints.length === 0;

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
        {disabled ? "No more hints" : "Hint"}
      </Button>
    </div>
  );
}
