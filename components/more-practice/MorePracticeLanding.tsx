import Link from "next/link";

type FeatureCard = {
  emoji: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  accent: string;
  btnClass: string;
};

const FEATURES: FeatureCard[] = [
  {
    emoji: "♾️",
    title: "Endless Practice",
    description:
      "An adaptive, never-ending stream of algebra problems that scales its difficulty to you. Topics unlock as you complete their lessons.",
    href: "/practice",
    cta: "Start practicing",
    accent: "bg-accent-cyan",
    btnClass: "btn-pop bg-accent-cyan text-white",
  },
  {
    emoji: "📝",
    title: "Practice Tests",
    description:
      "Generate a focused, graded practice test built from the concepts you've recently reviewed — so it tests what's settling into memory.",
    href: "/sandbox/practice-test",
    cta: "Build a test",
    accent: "bg-accent-purple",
    btnClass: "btn-pop bg-accent-purple text-white",
  },
];

export function MorePracticeLanding() {
  return (
    <div className="flex flex-col gap-5">
      {FEATURES.map((feature) => (
        <article key={feature.title} className="card-pop p-6">
          <div className="flex items-start gap-4">
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${feature.accent} text-2xl`}
              aria-hidden
            >
              {feature.emoji}
            </span>
            <div className="min-w-0">
              <h2 className="font-heading text-heading-md text-text">
                {feature.title}
              </h2>
              <p className="mt-1 text-body text-muted">{feature.description}</p>
            </div>
          </div>

          <Link
            href={feature.href}
            className={`${feature.btnClass} mt-5 inline-flex w-full items-center justify-center px-5 py-3 text-center font-heading text-body`}
          >
            {feature.cta}
          </Link>
        </article>
      ))}
    </div>
  );
}
