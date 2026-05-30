"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-lg border p-4 text-sm text-center space-y-1">
        <p className="font-medium">Check your inbox</p>
        <p className="text-muted-foreground">We sent a magic link to {email}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleMagicLink} className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">
            Email <span className="text-[var(--brand)]">*</span>
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? "Sending..." : "Send magic link"}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs text-muted-foreground">
          <span className="bg-background px-2">or</span>
        </div>
      </div>

      <button
        onClick={handleGoogle}
        disabled={loading}
        className="w-full rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
      >
        Continue with Google
      </button>
    </div>
  );
}
