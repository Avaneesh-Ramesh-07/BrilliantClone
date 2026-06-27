"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

/**
 * Resolves a post-login redirect target from the `next` query param. Only a
 * same-origin RELATIVE path (e.g. "/arena/123") is allowed — anything absolute
 * ("https://…"), protocol-relative ("//evil.com"), or otherwise malformed falls
 * back to "/home". This prevents the `next` param from being abused as an open
 * redirect while still letting an invited arena guest return to their challenge.
 */
function safeNext(raw: string | null): string {
  if (!raw) return "/home";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/home";
  return raw;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      setError("Invalid email or password. Please try again.");
      return;
    }

    // Honor an optional `next` target (e.g. an arena invite link sends
    // `/login?next=/arena/<id>` so the user returns to the challenge after
    // signing in). Read it client-side from the URL to avoid needing a
    // useSearchParams Suspense boundary. Defaults to /home.
    const next =
      typeof window !== "undefined"
        ? safeNext(new URLSearchParams(window.location.search).get("next"))
        : "/home";

    router.push(next);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col justify-center py-12">
      <h1 className="font-heading text-heading-lg">Log In</h1>
      <p className="mt-2 text-body text-muted">Welcome back to AlgebraDojo.</p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="text-label text-muted">
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <label htmlFor="password" className="text-label text-muted">
            Password
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1"
          />
        </div>

        {error && (
          <p className="text-feedback text-error" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" fullWidth disabled={loading}>
          {loading ? "Logging in…" : "Log In"}
        </Button>
      </form>

      <p className="mt-6 text-center text-body text-muted">
        No account?{" "}
        <Link href="/signup" className="text-primary underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
