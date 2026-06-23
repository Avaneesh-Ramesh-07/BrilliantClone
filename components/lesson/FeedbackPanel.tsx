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
          : "border-error/30 bg-error/5 text-error"
      }`}
      role="status"
    >
      <p className="text-feedback">{message}</p>
    </div>
  );
}
