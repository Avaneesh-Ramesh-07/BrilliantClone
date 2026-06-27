"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string;
  icon: string;
};

const TABS: Tab[] = [
  { href: "/home", label: "Home", icon: "🏠" },
  { href: "/more-practice", label: "More Practice", icon: "✏️" },
  { href: "/mastery", label: "Mastery", icon: "🏆" },
  { href: "/duels", label: "Duels", icon: "⚔️" },
];

// Only render the nav on the four top-level tab routes; hide everywhere else.
const SHOW_ON = new Set(["/home", "/more-practice", "/mastery", "/duels"]);

export default function TopNav() {
  const pathname = usePathname();

  if (!SHOW_ON.has(pathname)) return null;

  return (
    <nav className="sticky top-0 z-40 -mx-4 mb-4 border-b border-border bg-surface/95 px-4 backdrop-blur">
      <ul className="flex items-stretch justify-between gap-1 py-2">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-center text-label transition-colors",
                  active
                    ? "bg-primary-light font-semibold text-primary"
                    : "text-muted hover:text-text",
                ].join(" ")}
              >
                <span className="text-base leading-none" aria-hidden="true">
                  {tab.icon}
                </span>
                <span className="text-[11px] leading-tight">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
