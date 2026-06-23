import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center py-12 text-center">
      <h1 className="font-heading text-heading-lg text-text">AlgebraPath</h1>
      <p className="mt-3 max-w-sm text-body text-muted">
        Learn algebra by solving equations hands-on — drag terms, find x, and
        build real understanding.
      </p>
      <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
        <Link href="/signup">
          <Button fullWidth>Sign Up</Button>
        </Link>
        <Link href="/login">
          <Button variant="secondary" fullWidth>
            Log In
          </Button>
        </Link>
      </div>
    </main>
  );
}
