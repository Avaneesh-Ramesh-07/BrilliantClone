export type LessonStatus = "not_started" | "in_progress" | "complete";

export interface EquationState {
  left: string[];
  right: string[];
}

export interface GridLineConfig {
  label: string;
  fn: string;
}

export interface GridPlotVisual {
  type: "grid-plot";
  leftLine: GridLineConfig;
  rightLine: GridLineConfig;
  solution: number;
  verticalLine?: boolean;
}

export interface GridAnimation {
  gridAnimatesIn?: boolean;
  greenVerticalLine?: boolean;
  pulseIntersection?: [number, number];
}

export interface DragMove {
  targetTile: string;
  targetSide: "left" | "right";
  resultLeft: string[];
  resultRight: string[];
  intermediateLabel?: string;
  blockedUntilPreviousMove?: boolean;
  bounceBackOnEarlyAttempt?: boolean;
}

export interface ProblemFeedback {
  correct: string;
  incorrect?: string;
  incorrect_moved_x?: string;
  incorrect_moved_right?: string;
  incorrect_wrong_tile?: string;
  incorrect_wrong_order?: string;
}

export interface ConceptProblem {
  id: string;
  type: "concept";
  prompt: string;
  feedback?: ProblemFeedback;
}

export interface NumericInputProblem {
  id: string;
  type: "numeric-input";
  prompt: string;
  answer: number;
  feedback: ProblemFeedback;
}

export interface MultipleChoiceOption {
  id: string;
  text: string;
  correct: boolean;
}

export interface MultipleChoiceProblem {
  id: string;
  type: "multiple-choice";
  prompt: string;
  options: MultipleChoiceOption[];
  feedback: ProblemFeedback;
}

export interface DragToSolveProblem {
  id: string;
  type: "drag-to-solve";
  /**
   * When true, this is a guided demonstration rather than a graded question. It
   * is shown with a "Demo" badge, excluded from mastery scoring, and never
   * triggers regression/redemption.
   */
  demo?: boolean;
  prompt: string;
  equation: EquationState;
  targetTile?: string;
  targetSide?: "left" | "right";
  solution?: EquationState;
  moves?: DragMove[];
  answer: number;
  visual?: GridPlotVisual;
  animation?: GridAnimation;
  feedback: ProblemFeedback;
}

export interface SliderBalanceProblem {
  id: string;
  type: "slider-balance";
  prompt: string;
  answer: number;
  sliderMin: number;
  sliderMax: number;
  sliderDefault?: number;
  leftLabel: string;
  rightLabel: string;
  rightValue: number;
  feedback: ProblemFeedback;
}

export type Problem =
  | ConceptProblem
  | NumericInputProblem
  | MultipleChoiceProblem
  | DragToSolveProblem
  | SliderBalanceProblem;

export interface StepCompletionAction {
  buttonLabel: string;
  nextStepId?: string;
  route?: string;
}

export interface Step {
  id: string;
  title: string;
  concept: string;
  conceptFraming: string;
  masteryThreshold: number;
  fallbackStepId: string;
  fallbackMessage: string;
  partialMasteryMessage?: string;
  skipMasteryGate?: boolean;
  isLastStep?: boolean;
  hints: string[];
  completionAction: StepCompletionAction;
  /**
   * Number of problems to present from the `problems` bank. The first problem
   * (the teaching "anchor") is always included; the rest are sampled at random
   * so a fresh set appears each time the lesson is started or restarted.
   * When omitted, all problems are presented.
   */
  present?: number;
  problems: Problem[];
}

export interface Lesson {
  id: string;
  title: string;
  subject: string;
  description: string;
  estimatedMinutes: number;
  totalSteps: number;
  masteryRule?: {
    description: string;
    nextButtonVisibleOnlyAfterMastery: boolean;
  };
  steps: Step[];
}

export interface LessonProgress {
  status: LessonStatus;
  current_step_index: number;
  completed_at?: string | null;
  /** Total active solve time (ms) of the most recent completed run. */
  last_duration_ms?: number | null;
}

export interface MasteryResult {
  passed: boolean;
  rate: number;
  fallbackStepId?: string;
  fallbackMessage?: string;
  partialMasteryMessage?: string;
}

export interface FeedbackState {
  message: string;
  isCorrect: boolean;
}
