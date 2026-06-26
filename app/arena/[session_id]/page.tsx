import { ArenaRoom } from "@/components/arena/ArenaRoom";
import { fetchSession } from "@/lib/arena/session";
import { getProfile } from "@/lib/progress";
import { createClient } from "@/lib/supabase/server";

interface ArenaSessionPageProps {
  params: Promise<{ session_id: string }>;
}

export default async function ArenaSessionPage({
  params,
}: ArenaSessionPageProps) {
  const { session_id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const session = await fetchSession(supabase, session_id);

  // Viewer profile (logged in) + creator name for display.
  const viewerProfile = user ? await getProfile(supabase, user.id) : null;
  const creatorProfile =
    session?.created_by != null
      ? await getProfile(supabase, session.created_by)
      : null;

  // Completed lesson ids for the viewer (authenticated pool source).
  let completedLessonIds: string[] = [];
  if (user) {
    const { data: completedRows } = await supabase
      .from("lesson_progress")
      .select("lesson_id")
      .eq("user_id", user.id)
      .eq("status", "complete");
    completedLessonIds = (completedRows ?? []).map((r) => r.lesson_id as string);
  }

  return (
    <ArenaRoom
      sessionId={session_id}
      initialSession={session}
      viewerId={user?.id ?? null}
      viewerName={viewerProfile?.display_name ?? null}
      creatorName={creatorProfile?.display_name ?? null}
      completedLessonIds={completedLessonIds}
    />
  );
}
