"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { resolveRoomCode } from "@/app/arena/actions";
import { normalizeRoomCode } from "@/lib/arena/session";

interface JoinByCodeProps {
  /** Optional heading shown above the input. */
  title?: string;
  className?: string;
}

/**
 * A small "enter a room code to join" box. Resolves the code to a session id via
 * the resolveRoomCode server action, then routes into the existing /arena/[id]
 * flow (which handles auth auto-join and guest name entry). Works for both
 * logged-in opponents and anon guests.
 */
export function JoinByCode({
  title = "Have a room code?",
  className = "",
}: JoinByCodeProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    const normalized = normalizeRoomCode(code);
    if (normalized.length !== 6) {
      setError("Enter the 6-character room code.");
      return;
    }
    setError(null);
    setLoading(true);
    const sessionId = await resolveRoomCode(normalized);
    setLoading(false);
    if (!sessionId) {
      setError("That code is invalid, full, or expired.");
      return;
    }
    router.push(`/arena/${sessionId}`);
  }

  return (
    <div className={`rounded-xl border border-border bg-surface p-4 ${className}`}>
      <p className="text-label font-semibold text-text">{title}</p>
      <p className="mt-1 text-body text-muted">
        Join a challenge by typing the opponent&apos;s code.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={6}
          value={code}
          placeholder="ABC123"
          aria-label="Room code"
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleJoin();
          }}
          className="tracking-[0.3em] uppercase"
        />
        <Button
          type="button"
          className="min-h-[48px] sm:w-auto"
          disabled={loading}
          onClick={handleJoin}
        >
          {loading ? "Joining…" : "Join"}
        </Button>
      </div>
      {error && (
        <p className="mt-2 text-feedback text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
