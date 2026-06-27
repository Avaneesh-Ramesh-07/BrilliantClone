import { MathText } from "./MathText";

interface FeedbackPanelProps {
  message: string;
  isCorrect: boolean;
  visible: boolean;
}

export function FeedbackPanel({
  message,
  isCorrect,
  visible,
}: FeedbackPanelProps) {
  if (!visible) return null;

  return (
    <div
      className={`mt-4 rounded-lg border px-4 py-3 ${
        isCorrect
          ? "border-success/30 bg-success/5 text-success"
          : "border-border bg-surface text-text"
      }`}
      role="status"
    >
      <p className="text-feedback">
        <MathText text={message} />
      </p>
    </div>
  );
}
