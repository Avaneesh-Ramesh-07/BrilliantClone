import Link from "next/link";
import { redirect } from "next/navigation";
import { MorePracticeLanding } from "@/components/more-practice/MorePracticeLanding";
import { createClient } from "@/lib/supabase/server";

export default async function MorePracticePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="py-8">
      <header className="mb-6">
        <Link
          href="/home"
          className="inline-flex items-center gap-1 text-label text-muted transition-colors hover:text-text"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to lessons
        </Link>
        <h1 className="mt-3 font-heading text-heading-lg text-text">
          More Practice
        </h1>
        <p className="mt-1 text-body text-muted">
          Two ways to keep your algebra sharp — pick a path and dive in.
        </p>
      </header>

      <MorePracticeLanding />
    </main>
  );
}
