import type { ConceptProblem } from "@/types/lesson";
import { MathText } from "@/components/lesson/MathText";

interface ConceptStepProps {
  problem: ConceptProblem;
}

export function ConceptStep({ problem }: ConceptStepProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-body text-text">
        <MathText text={problem.prompt} />
      </p>
    </div>
  );
}
