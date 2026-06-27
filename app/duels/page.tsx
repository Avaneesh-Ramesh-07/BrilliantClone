import { redirect } from "next/navigation";
import { DuelsLanding } from "@/components/duels/DuelsLanding";
import { countDuelWins, getDuelRank } from "@/lib/arena/rank";
import { getProfile } from "@/lib/progress";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DuelsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [wins, profile] = await Promise.all([
    countDuelWins(supabase, user.id),
    getProfile(supabase, user.id),
  ]);
  const rank = getDuelRank(wins);
  const username = profile?.display_name ?? "You";

  return <DuelsLanding rank={rank} username={username} />;
}
