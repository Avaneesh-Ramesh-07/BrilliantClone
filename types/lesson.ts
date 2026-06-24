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
  /** One conceptual nudge revealed after a wrong attempt. Never the answer. */
  hint?: string;
  /** Per-question override of the step's reinforcement interactive. */
  interactive?: InteractiveHelper;
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
  /** One conceptual nudge revealed after a wrong attempt. Never the answer. */
  hint?: string;
  /** Per-question override of the step's reinforcement interactive. */
  interactive?: InteractiveHelper;
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
  /** One conceptual nudge revealed after a wrong attempt. Never the answer. */
  hint?: string;
  /** Per-question override of the step's reinforcement interactive. */
  interactive?: InteractiveHelper;
  feedback: ProblemFeedback;
}

/**
 * A guided "building blocks" demo for isolating a variable. The equation
 * `coefficient·variable + constant = rightValue` is shown as physical blocks
 * and solved one move at a time:
 *   - subtract move (when constant !== 0): drag the constant blocks to the
 *     trash to remove them from both sides.
 *   - divide move (when coefficient !== 1): tap "Divide both sides by N" to
 *     split each side into equal groups.
 * Two-step equations chain both moves (subtract first, then divide).
 */
export interface IsolateBlocksProblem {
  id: string;
  type: "isolate-blocks";
  demo?: boolean;
  /** Goal framing, e.g. "Get x by itself on the left side." */
  prompt: string;
  /** The question posed to the learner for the first move. */
  question: string;
  variable: string;
  /** Number multiplying the variable. Defaults to 1 (no division needed). */
  coefficient?: number;
  /** Constant added on the left. May be 0 (no subtraction needed). */
  constant: number;
  rightValue: number;
  feedback: ProblemFeedback;
}

/**
 * A guided graphing demo: a line `y = slope·x + intercept` is drawn on a
 * coordinate grid with a ball the learner slides along it (the slider sets the
 * ball's x). Moving the ball to the y-axis (x = targetX, default 0) reveals the
 * y-intercept and completes the demo.
 */
export interface GraphInterceptProblem {
  id: string;
  type: "graph-intercept";
  demo?: boolean;
  prompt: string;
  /** Human-readable equation, e.g. "y = 2x + 4". */
  equationLabel: string;
  slope: number;
  intercept: number;
  xMin: number;
  xMax: number;
  xDefault?: number;
  /** The x the learner must slide the ball to. Defaults to 0 (the y-axis). */
  targetX?: number;
  feedback: ProblemFeedback;
}

/**
 * A guided "slope race" demo: two side-by-side graphs each show a downward
 * line with a ball at the top and a slider to adjust the slope. Pressing play
 * releases both balls; the steeper slope reaches the bottom first. Afterwards a
 * multiple-choice question (with "{side}" substituted by the steeper graph's
 * side) reinforces why.
 */
export interface SlopeRaceProblem {
  id: string;
  type: "slope-race";
  demo?: boolean;
  prompt: string;
  /** MC question; "{side}" is replaced with the steeper graph's side. */
  question: string;
  options: MultipleChoiceOption[];
  feedback: ProblemFeedback;
}

/**
 * A guided "plot the point" demo: the learner is shown an empty coordinate grid
 * and clicks the point they're solving for (e.g. the y-intercept at
 * (targetX, targetY)). Hovering the grid reveals the coordinate under the
 * cursor. Clicking the target point completes the demo.
 */
export interface PlotPointProblem {
  id: string;
  type: "plot-point";
  demo?: boolean;
  prompt: string;
  targetX: number;
  targetY: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  feedback: ProblemFeedback;
}

/**
 * The self-contained interactives that can be surfaced to reinforce a concept
 * when a learner is struggling with a graded question. These manage their own
 * state and signal completion via `onCorrect`; they are NOT graded problems.
 */
export type InteractiveHelper =
  | IsolateBlocksProblem
  | PlotPointProblem
  | SlopeRaceProblem;

export type Problem =
  | ConceptProblem
  | NumericInputProblem
  | MultipleChoiceProblem
  | DragToSolveProblem
  | SliderBalanceProblem
  | IsolateBlocksProblem
  | GraphInterceptProblem
  | SlopeRaceProblem
  | PlotPointProblem;

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
  /**
   * Reinforcement interactive for this step's concept. Surfaced when a learner
   * misses a graded question again after seeing its hint. Individual questions
   * may override this with their own `interactive`.
   */
  interactive?: InteractiveHelper;
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
  /** Durable "finished at least once" flag; kept through restarts to keep later lessons unlocked. */
  ever_completed?: boolean;
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
