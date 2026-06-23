"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName.trim() || "Student" },
      },
    });

    setLoading(false);

    // #region agent log
    fetch("http://127.0.0.1:7317/ingest/5ca51102-074a-497f-a02f-436942c7f190", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "427e58",
      },
      body: JSON.stringify({
        sessionId: "427e58",
        runId: "pre-fix",
        hypothesisId: "H1-H3",
        location: "app/signup/page.tsx:handleSubmit",
        message: "signup attempt result",
        data: {
          hasUser: !!data?.user,
          hasSession: !!data?.session,
          userConfirmedAt: data?.user?.email_confirmed_at ?? null,
          userCreatedAt: data?.user?.created_at ?? null,
          identitiesCount: data?.user?.identities?.length ?? 0,
          errorCode: authError?.code ?? null,
          errorMessage: authError?.message ?? null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    if (authError) {
      setError(authError.message);
      return;
    }

    router.push("/home");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col justify-center py-12">
      <h1 className="font-heading text-heading-lg">Sign Up</h1>
      <p className="mt-2 text-body text-muted">
        Create your AlgebraPath account.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <div>
          <label htmlFor="name" className="text-label text-muted">
            Name
          </label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1"
          />
        </div>
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
            autoComplete="new-password"
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
          {loading ? "Creating account…" : "Sign Up"}
        </Button>
      </form>

      <p className="mt-6 text-center text-body text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-primary underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
