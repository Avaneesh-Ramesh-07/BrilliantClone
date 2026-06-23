export interface SkillActivityItem {
  skill: string;
  daysSince: number | null;
}

interface SkillActivityProps {
  items: SkillActivityItem[];
}

function describe(daysSince: number | null): { label: string; tone: string } {
  if (daysSince === null) return { label: "Not practiced yet", tone: "text-muted" };
  if (daysSince <= 0) return { label: "Practiced today", tone: "text-success" };
  if (daysSince === 1) return { label: "Yesterday", tone: "text-text" };
  if (daysSince <= 6) return { label: `${daysSince} days ago`, tone: "text-text" };
  return { label: `${daysSince} days ago`, tone: "text-error" };
}

export function SkillActivity({ items }: SkillActivityProps) {
  if (items.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-4 text-label text-muted">Skill activity</h2>
      <ul className="overflow-hidden rounded-xl border border-border bg-surface">
        {items.map((item, i) => {
          const { label, tone } = describe(item.daysSince);
          return (
            <li
              key={item.skill}
              className={`flex items-center justify-between gap-3 px-4 py-3 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <span className="text-body text-text">{item.skill}</span>
              <span className={`shrink-0 text-label ${tone}`}>{label}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
