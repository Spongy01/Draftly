// Dashboard: greeting, new document, "My documents" and "Shared with me"
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listDocumentsForUser } from "@/lib/documents";
import LocalTime from "@/components/ui/LocalTime";
import RoleBadge from "@/components/ui/RoleBadge";
import LogoutButton from "./LogoutButton";
import ImportButton from "./ImportButton";
import NewDocumentButton from "./NewDocumentButton";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { owned, shared } = await listDocumentsForUser(user.id);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm opacity-80">Signed in as {user.name}</p>
          <p className="text-sm opacity-80">
            You own {owned.length} {owned.length === 1 ? "document" : "documents"}
          </p>
        </div>
        <LogoutButton />
      </header>

      <div className="mt-8 flex flex-wrap items-start gap-x-6 gap-y-3">
        <NewDocumentButton />
        <ImportButton />
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">My documents</h2>
        {owned.length === 0 ? (
          <p className="mt-3 rounded border border-dashed border-gray-400 p-6 text-sm opacity-80">
            You don&apos;t have any documents yet. Click &ldquo;New document&rdquo; to create one.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-300/50 rounded border border-gray-300/50">
            {owned.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/doc/${d.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-500/10"
                >
                  <span className="truncate font-medium">{d.title}</span>
                  <span className="shrink-0 text-xs opacity-70">
                    Updated <LocalTime iso={d.updatedAt.toISOString()} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Shared with me</h2>
        {shared.length === 0 ? (
          <p className="mt-3 rounded border border-dashed border-gray-400 p-6 text-sm opacity-80">
            Nothing has been shared with you yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-300/50 rounded border border-gray-300/50">
            {shared.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/doc/${d.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-500/10"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{d.title}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs opacity-80">
                      <RoleBadge access={d.role === "EDITOR" ? "editor" : "viewer"} />
                      Owned by {d.ownerName}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs opacity-70">
                    Updated <LocalTime iso={d.updatedAt.toISOString()} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
