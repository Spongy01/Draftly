import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm opacity-80">
        This page doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
      <Link href="/dashboard" className="mt-2 rounded border border-gray-500 px-4 py-2 text-sm">
        Back to dashboard
      </Link>
    </main>
  );
}
