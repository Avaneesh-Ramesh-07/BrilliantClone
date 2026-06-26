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

  return (
    <ArenaLobby
      userId={user.id}
      displayName={profile?.display_name ?? "You"}
      completedLessonIds={completedLessonIds}
    />
  );
}
