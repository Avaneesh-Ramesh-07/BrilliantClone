import type { SupabaseClient } from "@supabase/supabase-js";

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDate(d);
}

export async function updateStreak(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const today = formatDate(new Date());

  const { data: existing } = await supabase
    .from("streaks")
    .select("current_streak, longest_streak, last_activity_date")
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) {
    await supabase.from("streaks").insert({
      user_id: userId,
      current_streak: 1,
      longest_streak: 1,
      last_activity_date: today,
    });
    return;
  }

  if (existing.last_activity_date === today) {
    return;
  }

  let newStreak = 1;
  if (existing.last_activity_date === yesterday()) {
    newStreak = existing.current_streak + 1;
  }

  const longestStreak = Math.max(existing.longest_streak, newStreak);

  await supabase
    .from("streaks")
    .update({
      current_streak: newStreak,
      longest_streak: longestStreak,
      last_activity_date: today,
    })
    .eq("user_id", userId);
}
