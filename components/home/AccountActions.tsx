"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface AccountActionsProps {
  email: string;
}

export function AccountActions({ email }: AccountActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<"logout" | "switch" | "signup" | null>(
    null
  );
  const menuRef = useRef<HTMLDivElement>(null);

  const initial = email.trim().charAt(0).toUpperCase() || "?";

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function signOutAndGo(path: "/login" | "/signup" | "/") {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(path);
    router.refresh();
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-body font-semibold text-white shadow-sm ring-1 ring-border transition-opacity hover:opacity-90"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="text-label text-muted">Signed in as</p>
            <p className="mt-0.5 truncate text-body text-text">{email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            disabled={loading !== null}
            onClick={() => {
              setLoading("switch");
              void signOutAndGo("/login");
            }}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-body text-text hover:bg-primary-light disabled:opacity-50"
          >
            <SwitchIcon />
            {loading === "switch" ? "Signing out…" : "Switch account"}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={loading !== null}
            onClick={() => {
              setLoading("signup");
              void signOutAndGo("/signup");
            }}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-body text-text hover:bg-primary-light disabled:opacity-50"
          >
            <PlusIcon />
            {loading === "signup" ? "Signing out…" : "Sign up new account"}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={loading !== null}
            onClick={() => {
              setLoading("logout");
              void signOutAndGo("/");
            }}
            className="flex w-full items-center gap-2 border-t border-border px-4 py-3 text-left text-body text-error hover:bg-error/5 disabled:opacity-50"
          >
            <LogoutIcon />
            {loading === "logout" ? "Logging out…" : "Log out"}
          </button>
        </div>
      )}
    </div>
  );
}

function iconClass() {
  return "h-4 w-4 shrink-0";
}

function SwitchIcon() {
  return (
    <svg className={iconClass()} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 10l-3 3 3 3M4 13h11M17 14l3-3-3-3M20 11H9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className={iconClass()} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className={iconClass()} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 12H4m0 0l4-4m-4 4l4 4M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
