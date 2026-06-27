import { JoinByCode } from "@/components/arena/JoinByCode";

/**
 * Public join-by-code entry point. Unlike /arena (the challenger lobby, which
 * redirects unauthenticated visitors to /login), this page is reachable by
 * anyone — including anon guests — so an opponent can type a room code and be
 * routed into the existing /arena/[id] join flow. The static `join` segment
 * takes precedence over the dynamic [session_id] route.
 */
export default function ArenaJoinPage() {
  return (
    <main className="flex min-h-screen flex-col justify-center px-6 py-12">
      <h1 className="font-heading text-heading-lg text-text">⚔️ Join a duel</h1>
      <p className="mt-2 text-body text-muted">
        Enter the room code your challenger shared with you.
      </p>
      <div className="mt-6">
        <JoinByCode title="Room code" />
      </div>
    </main>
  );
}
