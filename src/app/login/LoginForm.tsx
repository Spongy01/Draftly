"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-accounts";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("Network error. Please try again.");
    }
    setPending(false);
  }

  return (
    <>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="rounded border border-gray-300 bg-white px-3 py-2 text-base text-black"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="rounded border border-gray-300 bg-white px-3 py-2 text-base text-black"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-gray-500 bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <section aria-labelledby="demo-accounts" className="mt-8 rounded border border-gray-400/60 p-4">
        <h2 id="demo-accounts" className="text-sm font-semibold">
          Demo accounts
        </h2>
        <p className="mt-1 text-xs opacity-70">
          Click an account to fill the form. Password for all: <code>{DEMO_PASSWORD}</code>
        </p>
        <ul className="mt-3 flex flex-col gap-1">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.email}>
              <button
                type="button"
                onClick={() => {
                  setEmail(a.email);
                  setPassword(DEMO_PASSWORD);
                  setError(null);
                }}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-gray-500/20"
              >
                <span>{a.email}</span>
                <span className="text-xs opacity-70">{a.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
