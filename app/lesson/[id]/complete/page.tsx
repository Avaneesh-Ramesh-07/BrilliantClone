import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RestartLessonButton } from "@/components/lesson/RestartLessonButton";
import { Button } from "@/components/ui/Button";
import { formatDuration } from "@/lib/comfort";
import { getLesson } from "@/lib/lessons";
import { completeLesson, getLessonProgress } from "@/lib/progress";
import { createClient } from "@/lib/supabase/server";

interface CompletePageProps {
  params: Promise<{ id: string }>;
}

const CELEBRATION_TITLES = [
  "Congrats! You're an expert at <lesson name>",
  "<lesson name> Mastered!",
  "You've solved <lesson name>",
  "Officially certified in <lesson name>",
  "You're now a <lesson name> expert",
  "Achievement unlocked: <lesson name> mastery",
  "You conquered <lesson name>",
  "Your <lesson name> skills are now a constant",
];

const CELEBRATION_SUBTITLES = [
  "Awesome job today! I'd be **line** if I said I wasn't proud of your progress!!",
  "Way to go! You're on the true path to being an Algebra Warrior!!",
  "Amazing job! Congrats on finishing <lesson name>",
  "Woah! I don't know very many people with your alge-brains!! Congrats on completing the lesson!!",
  "You really solved for success today! Congrats on mastering <lesson name>!",
  "Your skills are growing at an exponential rate! Nice work finishing <lesson name>!",
  "Looks like you've found the value of x-cellence. Congrats on completing <lesson name>!",
  "You and algebra are becoming a perfect function. Great job on <lesson name>!",
  "That lesson didn't stand a chance—you factored it completely! Congrats!",
  "You've officially crossed the equal sign into expertise. Well done!",
  "Your algebra skills are adding up fast! Congrats on finishing <lesson name>!",
  "You really know how to balance a challenge. Nice work completing <lesson name>!",
  "Looks like you've got all the right variables for success!",
  "You didn't just solve the problem—you solved the whole lesson!",
  "You've reached a positive solution set. Congrats on mastering <lesson name>!",
  "That's one less unknown in the universe. Nice work finding your way through <lesson name>!",
  "Your knowledge graph is looking pretty linear—in the best possible way!",
  "You've got serious alge-braingpower. Congrats on completing <lesson name>!",
  "You've transformed from variable to constant legend!",
  "Talk about a smooth operation—you handled that lesson like a pro!",
  "Your progress is greater than (>) expected!",
  "You've successfully isolated the most important variable: learning!",
  "That lesson has been officially eliminated from your system of equations.",
  "Congratulations! You're now in the solution set for <lesson name> experts.",
];

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** Substitutes the lesson name and renders **bold** segments of a message. */
function renderCelebration(template: string, lessonName: string) {
  const withName = template.replace(/<lesson name>/gi, lessonName);
  return withName.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    return bold ? (
      <strong key={i} className="font-semibold text-text">
        {bold[1]}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    );
  });
}

export default async function CompletePage({ params }: CompletePageProps) {
  const { id } = await params;
  const lesson = getLesson(id);

  if (!lesson) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let progress = await getLessonProgress(supabase, user.id, lesson.id);

  if (
    progress.status !== "complete" &&
    progress.current_step_index < lesson.totalSteps - 1
  ) {
    redirect(`/lesson/${id}`);
  }

  if (progress.status !== "complete") {
    await completeLesson(supabase, user.id, lesson.id);
    // Re-read so we pick up the total run time computed at completion.
    progress = await getLessonProgress(supabase, user.id, lesson.id);
  }

  const totalMs = progress.last_duration_ms ?? null;
  const title = pickRandom(CELEBRATION_TITLES);
  const subtitle = pickRandom(CELEBRATION_SUBTITLES);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center py-12 text-center">
      <p className="text-heading-lg">🎉</p>
      <h1 className="mt-4 font-heading text-heading-lg text-text">
        {renderCelebration(title, lesson.title)}
      </h1>
      <p className="mt-4 max-w-sm text-body text-muted">
        {renderCelebration(subtitle, lesson.title)}
      </p>

      {totalMs !== null && (
        <div className="mt-8 rounded-xl border border-border bg-surface px-6 py-4">
          <p className="text-label text-muted">Total time</p>
          <p className="mt-1 font-heading text-heading-lg text-text">
            {formatDuration(totalMs)}
          </p>
        </div>
      )}

      <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
        <Link href="/home">
          <Button fullWidth>Back to Home</Button>
        </Link>
        <RestartLessonButton lessonId={lesson.id} userId={user.id} />
      </div>
    </main>
  );
}
