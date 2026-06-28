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

/**
 * Marks a question as a "throwback": a low-stakes retrieval-practice question
 * that recalls material from an earlier step or an earlier lesson. Throwbacks
 * are shown as a warm-up at the start of a later step, are NOT counted toward
 * the current step's mastery, and never trigger redemption/regression, getting
 * one wrong simply reveals the answer and continues. This implements the
 * learning-science principle that retrieval (recalling half-forgotten material)
 * is where durable learning happens.
 */
export interface ThrowbackMeta {
  /**
   * Short label for where this question is recalled from, shown on the badge,
   * e.g. "Step 1 · Balancing" (same lesson) or "Linear Equations" (earlier lesson).
   */
  source: string;
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
  /**
   * Detailed worked solution revealed only once the problem is counted fully
   * wrong (the second miss). Distinct from the short `hint`. Populated for
   * practice-test problems; absent on normal lessons (which stay unchanged).
   */
  solution?: string;
  /** Per-question override of the step's reinforcement interactive. */
  interactive?: InteractiveHelper;
  /** Present when this is a retrieval-practice throwback (see {@link ThrowbackMeta}). */
  throwback?: ThrowbackMeta;
  feedback: ProblemFeedback;
}

export interface MultipleChoiceOption {
  id: string;
  text: string;
  correct: boolean;
  /**
   * Optional expression in `x` (e.g. "2*x + 3" or "x*x - 4") plotted on a small
   * preview grid when the problem has `graphOnSelect` and this option is chosen.
   */
  fn?: string;
}

export interface MultipleChoiceProblem {
  id: string;
  type: "multiple-choice";
  prompt: string;
  options: MultipleChoiceOption[];
  /** One conceptual nudge revealed after a wrong attempt. Never the answer. */
  hint?: string;
  /**
   * Detailed worked solution revealed only once the problem is counted fully
   * wrong (the second miss). Distinct from the short `hint`. Populated for
   * practice-test problems; absent on normal lessons (which stay unchanged).
   */
  solution?: string;
  /** Per-question override of the step's reinforcement interactive. */
  interactive?: InteractiveHelper;
  /**
   * When true, selecting an option plots that option's `fn` on a small grid so
   * the learner can see what the chosen equation looks like before committing.
   */
  graphOnSelect?: boolean;
  /** Grid bounds for the graph-on-select preview (defaults to ±6 if omitted). */
  graph?: { xMin: number; xMax: number; yMin: number; yMax: number };
  /** Present when this is a retrieval-practice throwback (see {@link ThrowbackMeta}). */
  throwback?: ThrowbackMeta;
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
 * Addition/subtraction demo. The equation `variable + constant = rightValue` is
 * shown as two clearly-separated vertical stacks of blocks: the left stack is
 * the variable block plus `constant` constant-blocks (x + N), the right stack is
 * `rightValue` blocks (N). The learner clicks an "Eliminate +N from both sides"
 * button (no dragging); that removes the constant blocks from both stacks,
 * leaving the variable isolated. Self-driven; calls onCorrect when done.
 */
export interface EliminateBlocksProblem {
  id: string;
  type: "eliminate-blocks";
  demo?: boolean;
  /** Goal framing, e.g. "Get x by itself on the left side." */
  prompt: string;
  /** The question posed to the learner. */
  question: string;
  variable: string;
  /**
   * Number of variable blocks shown on the left (the coefficient). Defaults to
   * 1. Values >1 (e.g. 2 for "2x + 3") are used by the two-step combo, where
   * eliminating the constant leaves `coefficient·variable = rightValue−constant`
   * rather than a fully isolated variable.
   */
  coefficient?: number;
  /** Positive constant added on the left (the "+N" to eliminate). */
  constant: number;
  rightValue: number;
  /**
   * Optional override for the wrong-answer distractor button. When omitted, the
   * default is an "add" distractor ("Add {constant} to both sides"). Set
   * `kind: "divide"` (used by the two-step combo) to present a "Divide both
   * sides by {coefficient}" trap whose wrong-state panel shows how dividing
   * before clearing the constant leaves ugly fractions.
   */
  distractor?: { label: string; kind: "add" | "divide" };
  feedback: ProblemFeedback;
}

/**
 * Multiplication/division demo framed as sharing pizza. The equation
 * `people · variable = slices` is shown as a pizza cut into `slices` equal
 * wedges that must be shared fairly among `people` people (max 2). The learner
 * clicks the slices for each person and submits per person; an unequal split is
 * rejected. Once both people have an equal share, the equation morphs
 * `people·x = slices → x = slices/people → x = answer`. Self-driven; calls
 * onCorrect when done.
 */
export interface PizzaShareProblem {
  id: string;
  type: "pizza-share";
  demo?: boolean;
  /** Goal framing. */
  prompt: string;
  /** The question posed to the learner. */
  question: string;
  variable: string;
  /** Number of people sharing the pizza (the coefficient). Max 2. */
  people: number;
  /** Total number of pizza slices (the right-hand value). Divisible by people. */
  slices: number;
  feedback: ProblemFeedback;
}

/**
 * Two-step demo `coefficient · variable + constant = rightValue`. Runs in two
 * stages: first an {@link EliminateBlocksProblem}-style block elimination of the
 * `+constant` (→ coefficient·x = rightValue − constant), then a
 * {@link PizzaShareProblem}-style fair share among `coefficient` people
 * (→ x = answer). Self-driven; calls onCorrect after both stages.
 */
export interface TwoStepShareProblem {
  id: string;
  type: "two-step-share";
  demo?: boolean;
  /** Goal framing. */
  prompt: string;
  /** The question posed for the first (elimination) stage. */
  question: string;
  variable: string;
  /** Number multiplying the variable, and the number of people for the share. Max 2. */
  coefficient: number;
  /** Positive constant added on the left (eliminated in stage one). */
  constant: number;
  rightValue: number;
  feedback: ProblemFeedback;
}

/**
 * Intro demo for "what is a variable". The equation `variable = value` is shown
 * with the variable drawn as a closed box. Tapping the box opens it to reveal
 * the number hiding inside (`value`), making concrete that a variable is just a
 * placeholder for an unknown number. Self-driven; calls onCorrect once opened.
 */
export interface VariableBoxProblem {
  id: string;
  type: "variable-box";
  demo?: boolean;
  /** Goal framing. */
  prompt: string;
  /** The question/explanation posed to the learner. */
  question: string;
  variable: string;
  /** The number hiding inside the box (what the variable equals). */
  value: number;
  feedback: ProblemFeedback;
}

/**
 * Division demo on a balance beam. The equation `coefficient · variable =
 * rightValue` is shown as a level scale (both pans weigh `rightValue`). The
 * learner chooses one of three moves, divide both sides by `coefficient`
 * (correct), or divide only the left / only the right (wrong). A one-sided
 * division tips the beam (the changed side no longer matches), demonstrating
 * that you must do the same to both sides. Dividing both sides keeps it level
 * and isolates the variable. Options and explanations are derived from
 * `coefficient`/`rightValue`. Self-driven; calls onCorrect on the correct move.
 */
export interface BalanceChoiceProblem {
  id: string;
  type: "balance-choice";
  demo?: boolean;
  /** Goal framing. */
  prompt: string;
  /** The question posed to the learner. */
  question: string;
  variable: string;
  /** The number multiplying the variable (the divisor to apply to both sides). */
  coefficient: number;
  /** The right-hand value. `rightValue / coefficient` must be a whole number. */
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
  /**
   * Optional quadratic y = a·x² + b·x + c to DRAW on the grid, so the learner
   * reads the crossings off a visible curve (used by the step-6 solutions
   * problems). When omitted, only the grid is shown (legacy single-point use).
   */
  a?: number;
  b?: number;
  c?: number;
  /**
   * Optional multi-point answer key. When present the learner must click EVERY
   * listed point (in any order), used for "pick both roots". Falls back to the
   * single {@link targetX}/{@link targetY} when omitted.
   */
  targets?: { x: number; y: number }[];
  /**
   * Require all {@link targets} before the problem is solved. Defaults to true
   * whenever `targets` holds more than one point.
   */
  requireAll?: boolean;
  feedback: ProblemFeedback;
}

/**
 * Animated physics demo over a parabola y = a·x² + b·x + c, used to teach
 * vertices and solutions:
 *   - mode "settle-min": balls released at the ends roll down to the vertex
 *     (the minimum) of an upward parabola.
 *   - mode "drop-max": balls drop onto a downward parabola at each ballStartXs;
 *     only the ball landing on the vertex (the maximum) stays, the rest roll off.
 *   - mode "settle-roots": balls roll down and settle where the curve crosses
 *     the x-axis (the solutions).
 * Self-driven; calls onCorrect when the animation completes. Not graded.
 */
export interface ParabolaBallsProblem {
  id: string;
  type: "parabola-balls";
  demo?: boolean;
  mode: "settle-min" | "drop-max" | "settle-roots";
  prompt: string;
  /** Human-readable equation, e.g. "y = x² − 4". */
  equationLabel: string;
  a: number;
  b: number;
  c: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  /** x-positions where balls begin (the ends for settle modes; drop points for drop-max). */
  ballStartXs: number[];
  feedback: ProblemFeedback;
}

/**
 * Interactive factoring demo. Shows the expanded quadratic with a "Factor"
 * button; pressing it splits the expression into its two factors and reveals
 * the zeros. Dragging one factor onto the other multiplies them back into the
 * original expanded form. Calls onCorrect once the learner has both factored
 * and recombined. Not graded.
 */
export interface FactorQuadraticProblem {
  id: string;
  type: "factor-quadratic";
  demo?: boolean;
  prompt: string;
  /** Expanded form, e.g. "x² + 5x + 6". */
  equationLabel: string;
  a: number;
  b: number;
  c: number;
  /** The two factor strings, e.g. ["(x + 2)", "(x + 3)"]. */
  factors: string[];
  /** The zeros, e.g. [-2, -3]. */
  roots: number[];
  feedback: ProblemFeedback;
}

/**
 * Linear-vs-quadratic demo. Plots y = coefficient·xⁿ where the learner toggles
 * the exponent n between 1 (a straight line) and 2 (a parabola) to feel how the
 * shape changes. Self-driven; calls onCorrect once both powers have been seen.
 * Not graded.
 */
export interface PowerToggleProblem {
  id: string;
  type: "power-toggle";
  demo?: boolean;
  prompt: string;
  /** Leading coefficient on the graphed term (default 1). */
  coefficient?: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  feedback: ProblemFeedback;
}

/**
 * "Concave up vs. down" demo. Plots y = a·x² + b·x + c with b and c fixed while
 * the learner drags a slider for `a` across negative and positive values,
 * watching the parabola flip between concave up (a>0) and concave down (a<0).
 * Self-driven; calls onCorrect once both a positive and a negative `a` have been
 * tried. Not graded.
 */
export interface ParabolaSliderProblem {
  id: string;
  type: "parabola-a-slider";
  demo?: boolean;
  prompt: string;
  /** Fixed b and c; the learner only varies a. */
  b: number;
  c: number;
  aMin: number;
  aMax: number;
  aDefault?: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  feedback: ProblemFeedback;
}

/**
 * Vertex-formula drag-and-drop demo. Shows y = a·x² + b·x + c and the template
 * x = −b / (2a) with two empty slots. The learner drags the numeric value of b
 * into the b-slot and a into the a-slot. A correct drop locks in; a wrong drop is
 * auto-rejected with an explanation (look at a / look at b). When both slots are
 * correct it auto-simplifies and reveals the vertex (x, y). Self-driven demo:
 * calls onCorrect when fully solved. Not graded.
 */
export interface VertexFormulaProblem {
  id: string;
  type: "vertex-formula";
  demo?: boolean;
  /** Goal framing. */
  prompt: string;
  /** Instruction shown to the learner. */
  question: string;
  /** Example quadratic coefficients: y = a·x² + b·x + c. */
  a: number;
  b: number;
  c: number;
  /** Numeric tokens for the draggable bank. Must include the values of a and b; the rest are distractors. All values must be distinct. */
  tokens: number[];
  feedback: ProblemFeedback;
}

/**
 * Quadratic-formula drag-and-drop demo. Shows the formula
 * x = (−b ± √(b² − 4ac)) / (2a) with empty a, b, c slots. The learner drags the
 * numeric values of a, b and c (from y = a·x² + b·x + c) into the slots. A wrong
 * drop is auto-rejected with an explanation. When all three are correct it
 * auto-substitutes, computes the discriminant, and reveals the two solutions.
 * Self-driven demo: calls onCorrect when fully solved. Not graded.
 */
export interface QuadraticFormulaProblem {
  id: string;
  type: "quadratic-formula";
  demo?: boolean;
  /** Goal framing. */
  prompt: string;
  /** Instruction shown to the learner. */
  question: string;
  /** Example quadratic coefficients: a·x² + b·x + c = 0. */
  a: number;
  b: number;
  c: number;
  /** Numeric tokens for the draggable bank. Must include the values of a, b and c; the rest are distractors. All values must be distinct. */
  tokens: number[];
  feedback: ProblemFeedback;
}

/**
 * Graded "click the vertex" problem. The parabola y = a·x² + b·x + c is drawn on
 * a grid and the learner clicks the point that is its minimum (target "min") or
 * maximum (target "max"), or presses a "There is no minimum/maximum" button.
 * A minimum exists only when a>0; a maximum only when a<0, so concave-down
 * parabolas correctly have "no minimum" and concave-up have "no maximum".
 * Self-driven via onCorrect/onIncorrect (like drag-to-solve); this IS graded.
 */
export interface VertexPickProblem {
  id: string;
  type: "vertex-pick";
  demo?: boolean;
  prompt: string;
  a: number;
  b: number;
  c: number;
  /** Which extremum the learner must identify. */
  target: "min" | "max";
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  feedback: ProblemFeedback;
}

/**
 * One option in a "pick the graph" question: a line `y = slope·x + intercept`
 * rendered as a small graph the learner can choose.
 */
export interface GraphOption {
  id: string;
  slope: number;
  intercept: number;
  correct: boolean;
}

/**
 * Graded "pick the matching graph" question. The learner is given an equation
 * and chooses which of several small line graphs matches it. Works like a
 * multiple-choice question (select, then Check), so it participates in the usual
 * hint / redemption / mastery flow.
 */
export interface PickGraphProblem {
  id: string;
  type: "pick-graph";
  prompt: string;
  /** The equation to match, e.g. "y = 2x − 1". */
  equationLabel: string;
  options: GraphOption[];
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  /** One conceptual nudge revealed after a wrong attempt. Never the answer. */
  hint?: string;
  /** Per-question override of the step's reinforcement interactive. */
  interactive?: InteractiveHelper;
  feedback: ProblemFeedback;
}

/**
 * Graded "graph the line" problem. Given an equation and a blank grid, the
 * learner plots the line in two clicks: first the y-intercept (0, intercept),
 * then a second lattice point on the line (using the slope). Self-driven via
 * onCorrect/onIncorrect (like vertex-pick); this IS graded. Lines should have an
 * integer slope so a second lattice point exists on the grid.
 */
export interface GraphLineProblem {
  id: string;
  type: "graph-line";
  prompt: string;
  /** Human-readable equation, e.g. "y = 2x − 1". */
  equationLabel: string;
  slope: number;
  intercept: number;
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
  | EliminateBlocksProblem
  | PizzaShareProblem
  | TwoStepShareProblem
  | BalanceChoiceProblem
  | PlotPointProblem
  | SlopeRaceProblem;

export type Problem =
  | ConceptProblem
  | NumericInputProblem
  | MultipleChoiceProblem
  | DragToSolveProblem
  | SliderBalanceProblem
  | IsolateBlocksProblem
  | EliminateBlocksProblem
  | PizzaShareProblem
  | TwoStepShareProblem
  | BalanceChoiceProblem
  | VariableBoxProblem
  | GraphInterceptProblem
  | SlopeRaceProblem
  | PlotPointProblem
  | ParabolaBallsProblem
  | FactorQuadraticProblem
  | PowerToggleProblem
  | ParabolaSliderProblem
  | VertexPickProblem
  | PickGraphProblem
  | GraphLineProblem
  | VertexFormulaProblem
  | QuadraticFormulaProblem;

export interface StepCompletionAction {
  buttonLabel: string;
  nextStepId?: string;
  route?: string;
}

/**
 * One piece of an annotated equation. Plain parts render as static text; parts
 * with a `note` become hoverable/tappable chips that reveal the note, so a long
 * prose explanation can be replaced by a short line plus an interactive formula.
 */
export interface EquationPart {
  text?: string;
  note?: string;
  /**
   * When set, this part renders as a true stacked fraction (numerator over a
   * bar over denominator) instead of plain `text`. Numerator/denominator are
   * themselves arrays of {@link EquationPart}, so each can carry its own
   * hoverable `note`.
   */
  fraction?: {
    numerator: EquationPart[];
    denominator: EquationPart[];
  };
}

/**
 * A compact, visual replacement for a long `conceptFraming` paragraph: a short
 * lead sentence plus an optional annotated equation whose key tokens are
 * hoverable. Rendered by AnnotatedFraming when present (falls back to the plain
 * `conceptFraming` string otherwise).
 */
export interface StepFraming {
  lead: string;
  equation?: EquationPart[];
  note?: string;
}

export interface Step {
  id: string;
  title: string;
  concept: string;
  conceptFraming: string;
  /** Optional visual/interactive framing that replaces the prose conceptFraming. */
  framing?: StepFraming;
  /** When true, the framing/conceptFraming is shown only while a demo problem is active. */
  framingDemoOnly?: boolean;
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
   * Number of problems to present from the `problems` bank. The first
   * `anchors` problems (the teaching anchors) are always included; the rest are
   * sampled at random so a fresh set appears each time the lesson is started or
   * restarted. When omitted, all problems are presented.
   */
  present?: number;
  /**
   * How many leading problems are pinned as always-present anchors (e.g. a demo
   * plus the two graphed practice problems). Defaults to 1 when omitted.
   */
  anchors?: number;
  /**
   * Optional bank of retrieval-practice throwback questions (each flagged with
   * `throwback`). One is chosen at random per run and prepended to this step's
   * problems as a low-stakes warm-up that recalls earlier material. Excluded
   * from mastery; never triggers redemption. Omit on a lesson's first step
   * unless it recalls a previous lesson.
   */
  throwbacks?: Problem[];
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
