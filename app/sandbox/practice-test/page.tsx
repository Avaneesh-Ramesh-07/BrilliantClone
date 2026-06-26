import { redirect } from "next/navigation";
import { PracticeTestBuilder } from "@/components/sandbox/PracticeTestBuilder";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PracticeTestPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <PracticeTestBuilder />;
}
