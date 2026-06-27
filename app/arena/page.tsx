import { redirect } from "next/navigation";
import { ArenaLobby } from "@/components/arena/ArenaLobby";
import { getProfile } from "@/lib/progress";
import { createClient } from "@/lib/supabase/server";

export default async function ArenaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The lobby is for the authenticated challenger (User 1).
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);

  const { data: completedRows } = await supabase
    .from("lesson_progress")
    .select("lesson_id")
    .eq("user_id", user.id)
    .eq("status", "complete");

  const completedLessonIds = (completedRows ?? []).map(
    (r) => r.lesson_id as string
  );

  // Gate: a signed-in user must complete at least one lesson before battling.
  // (Guests are exempt and handled on the joiner side.)
  if (completedLessonIds.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
        <h1 className="font-heading text-heading-lg text-text">
          Complete a lesson first
        </h1>
        <p className="mt-3 text-body text-muted">
          You need to finish at least one lesson before you can battle in the
          Arena.
        </p>
        <a
          href="/home"
          className="mt-8 inline-flex min-h-[48px] items-center justify-center rounded-lg bg-primary px-6 font-semibold text-white active:scale-95"
        >
          Go to Home
        </a>
      </main>
    );
  }

  return (
    <ArenaLobby
      userId={user.id}
      displayName={profile?.display_name ?? "You"}
      completedLessonIds={completedLessonIds}
    />
  );
}
