"use server";

import { revalidatePath } from "next/cache";

/**
 * Invalidates the cached Home and Mastery renders (server full-route cache and
 * the client Router Cache) so they re-fetch fresh lesson progress after the
 * learner exits, completes, or restarts a lesson.
 */
export async function revalidateProgressViews(): Promise<void> {
  revalidatePath("/home");
  revalidatePath("/mastery");
}
