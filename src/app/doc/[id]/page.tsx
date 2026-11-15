// Document page: title with inline rename, role badge, rich-text editor with autosave
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireDocumentAccess } from "@/lib/guard";
import { canEdit } from "@/lib/access";
import { getOwnerName } from "@/lib/documents";
import LocalTime from "@/components/ui/LocalTime";
import RoleBadge from "@/components/ui/RoleBadge";
import RenameTitle from "./RenameTitle";
import DocumentView from "./DocumentView";

export default async function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await requireDocumentAccess(id, "view");
  if (!g.ok) {
    if (g.status === 401) redirect("/login");
    notFound(); // 403 and 404 look the same
  }

  const ownerName = g.access === "owner" ? null : await getOwnerName(g.doc.ownerId);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/dashboard" className="text-sm underline opacity-80">
        &larr; Back to dashboard
      </Link>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <RenameTitle docId={g.doc.id} initialTitle={g.doc.title} canEdit={canEdit(g.access)} />
        <RoleBadge access={g.access} />
      </div>
      <p className="mt-1 text-xs opacity-70">
        {ownerName && <>Owned by {ownerName} &middot; </>}
        Updated <LocalTime iso={g.doc.updatedAt.toISOString()} />
      </p>

      <div className="mt-8">
        <DocumentView
          docId={g.doc.id}
          initialHtml={g.doc.contentHtml}
          canEdit={canEdit(g.access)}
        />
      </div>
    </main>
  );
}
