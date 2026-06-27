"use server";

import { getMonthlyActivity, type MonthlyActivity } from "@/lib/activity";
import { createClient } from "@/lib/supabase/server";

/**
 * Server action backing the inline Study Calendar's month navigation. Fetches a
 * single month of cross-activity totals for the signed-in user so the calendar
 * can move between months without a `/calendar` route.
 */
export async function getMonthActivity(
  year: number,
  month: number
): Promise<MonthlyActivity> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const safeYear =
    Number.isInteger(year) && year >= 1970 && year <= 9999
      ? year
      : new Date().getFullYear();
  const safeMonth =
    Number.isInteger(month) && month >= 1 && month <= 12
      ? month
      : new Date().getMonth() + 1;

  return getMonthlyActivity(supabase, user.id, safeYear, safeMonth);
}
