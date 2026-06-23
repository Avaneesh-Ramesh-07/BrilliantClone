import type { ConceptProblem } from "@/types/lesson";

interface ConceptStepProps {
  problem: ConceptProblem;
}

export function ConceptStep({ problem }: ConceptStepProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-body text-text">{problem.prompt}</p>
    </div>
  );
}
