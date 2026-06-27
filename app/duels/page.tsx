import { redirect } from "next/navigation";
import { DuelsLanding } from "@/components/duels/DuelsLanding";
import { countDuelWins, getDuelRank } from "@/lib/arena/rank";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DuelsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const wins = await countDuelWins(supabase, user.id);
  const rank = getDuelRank(wins);

  return <DuelsLanding rank={rank} />;
}
