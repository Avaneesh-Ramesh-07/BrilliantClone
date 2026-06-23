"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { restartLesson } from "@/lib/progress";
import { createClient } from "@/lib/supabase/client";

interface RestartLessonButtonProps {
  lessonId: string;
  userId: string;
}

export function RestartLessonButton({
  lessonId,
  userId,
}: RestartLessonButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRestart() {
    setLoading(true);
    const supabase = createClient();
    await restartLesson(supabase, userId, lessonId);
    router.push(`/lesson/${lessonId}`);
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="secondary"
      fullWidth
      disabled={loading}
      onClick={() => void handleRestart()}
    >
      {loading ? "Restarting…" : "Restart Lesson"}
    </Button>
  );
}
