"use client";

// Editor + autosave status for one document. Viewers get a read-only editor: no toolbar,
// no autosave, no indicator.
import Editor from "@/components/editor/Editor";
import { useAutosave } from "@/components/editor/useAutosave";

export default function DocumentView({
  docId,
  initialHtml,
  canEdit,
}: {
  docId: string;
  initialHtml: string;
  canEdit: boolean;
}) {
  const { status, error, notifyEdit, flush } = useAutosave(docId, canEdit);

  return (
    <div>
      {canEdit ? (
        <div aria-live="polite" className="mb-2 flex h-6 items-center gap-3 text-sm">
          {status === "saving" && <span className="opacity-70">Saving…</span>}
          {status === "saved" && <span className="opacity-70">Saved</span>}
          {status === "error" && (
            <>
              <span role="alert" className="text-red-600">
                {error ?? "Could not save your changes."}
              </span>
              <button
                type="button"
                onClick={flush}
                className="rounded border border-gray-500 px-2 py-0.5 text-xs"
              >
                Retry
              </button>
            </>
          )}
        </div>
      ) : (
        <p className="mb-2 h-6 text-sm opacity-70">View only</p>
      )}
      <Editor
        initialHtml={initialHtml}
        editable={canEdit}
        onUpdate={canEdit ? notifyEdit : undefined}
        onBlur={canEdit ? flush : undefined}
      />
    </div>
  );
}
