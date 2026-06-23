import { ProgressBar } from "@/components/ui/ProgressBar";

interface StepProgressBarProps {
  current: number;
  total: number;
}

export function StepProgressBar({ current, total }: StepProgressBarProps) {
  return (
    <ProgressBar
      value={current}
      max={total}
      label={`Step ${current} of ${total}`}
    />
  );
}
