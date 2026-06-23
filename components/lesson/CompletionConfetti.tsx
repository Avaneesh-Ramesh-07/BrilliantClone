"use client";

import { useEffect } from "react";
import { fireBigConfetti } from "@/lib/confetti";

export function CompletionConfetti() {
  useEffect(() => {
    fireBigConfetti();
    const again = window.setTimeout(() => fireBigConfetti(), 900);
    return () => window.clearTimeout(again);
  }, []);

  return null;
}
