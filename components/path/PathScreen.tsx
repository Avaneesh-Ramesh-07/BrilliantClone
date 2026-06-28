"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface PathScreenProps {
  /**
   * The learning-path nodes (lesson nodes etc.). Rendered inside the scrollable
   * main content area; the Arena call-to-action sits directly below them.
   */
  children?: ReactNode;
}

/**
 * The scrollable learning-path screen. After the path nodes it surfaces a
 * full-width call-to-action that takes the learner into the head-to-head Arena.
 */
export function PathScreen({ children }: PathScreenProps) {
  return (
    <main className="flex-1 overflow-y-auto pb-24">
      {/* Path nodes (lesson progression) */}
      <div className="flex flex-col items-center gap-4">{children}</div>

      {/* Arena call-to-action, below the path nodes, above the bottom nav. */}
      <div className="mt-6 px-4">
        <Link
          href="/arena"
          className="flex min-h-[48px] w-full items-center justify-center rounded-lg bg-red-600 text-white font-semibold transition-transform active:scale-95"
        >
          ⚔️ Test your skills in head-to-head
        </Link>
      </div>
    </main>
  );
}

export default PathScreen;
