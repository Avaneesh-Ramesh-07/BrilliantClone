/**
 * Topic taxonomy for the algebra/geometry curriculum. These helpers map a topic
 * id to its family, which the practice-test eligibility logic uses to group and
 * label a learner's lessons.
 */

// --- Topics ---------------------------------------------------------------

export type TopicFamily = "equations" | "graphing" | "quadratics";

export interface AllowedTopic {
  id: string;
  label: string;
  family: TopicFamily;
}

/** Intro algebra/geometry topics the Sandbox supports. */
export const ALLOWED_TOPICS: AllowedTopic[] = [
  { id: "variables-expressions", label: "Variables & Expressions", family: "equations" },
  { id: "linear-equations", label: "Linear Equations", family: "equations" },
  { id: "two-step-equations", label: "Two-Step Equations", family: "equations" },
  { id: "inequalities", label: "Inequalities", family: "equations" },
  { id: "graphing-lines", label: "Graphing Lines", family: "graphing" },
  { id: "slope", label: "Slope & Rate of Change", family: "graphing" },
  { id: "systems", label: "Systems of Equations", family: "graphing" },
  { id: "quadratics", label: "Intro to Quadratics", family: "quadratics" },
  { id: "other-algebra", label: "Other algebra…", family: "equations" },
];

export function getTopic(topic: string): AllowedTopic | undefined {
  return ALLOWED_TOPICS.find((t) => t.id === topic);
}

export function topicFamily(topic: string): TopicFamily {
  return getTopic(topic)?.family ?? "equations";
}
