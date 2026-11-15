"use client";

import Link from "next/link";

// The error object is deliberately not rendered: users never see messages or stack traces.
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-sm opacity-80">
        We couldn&apos;t load this page. Please try again in a moment.
      </p>
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded border border-gray-500 bg-black px-4 py-2 text-sm text-white"
        >
          Try again
        </button>
        <Link href="/dashboard" className="rounded border border-gray-500 px-4 py-2 text-sm">
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
