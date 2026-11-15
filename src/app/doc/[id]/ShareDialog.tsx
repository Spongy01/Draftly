"use client";

// Owner-only sharing UI: a Share button plus a native <dialog> modal (focus trap, Escape, backdrop).
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Role = "VIEWER" | "EDITOR";
type Collaborator = { userId: string; name: string; email: string; role: Role };

const ROLE_LABEL: Record<Role, string> = { VIEWER: "Viewer", EDITOR: "Editor" };

async function readError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error ?? fallback;
}

export default function ShareDialog({ docId }: { docId: string }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const [people, setPeople] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("VIEWER");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ userId: string; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/documents/${docId}/share`);
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) throw new Error(await readError(res, "Could not load collaborators."));
      const data = await res.json();
      setPeople(data.shares);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load collaborators.");
    }
    setLoading(false);
  }, [docId, router]);

  function open() {
    setEmail("");
    setRole("VIEWER");
    setAddError(null);
    setNotice(null);
    setRowError(null);
    dialogRef.current?.showModal();
    emailRef.current?.focus();
    void load();
  }

  function close() {
    dialogRef.current?.close();
  }

  // Runs for Escape, the Close button and backdrop clicks: return focus to the Share button.
  function onClosed() {
    buttonRef.current?.focus();
  }

  // Close when the click lands on the backdrop (the <dialog> element itself), not on its content.
  function onDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === e.currentTarget) close();
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => dialog?.close();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    setNotice(null);
    setAdding(true);
    try {
      const res = await fetch(`/api/documents/${docId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) {
        setAddError(await readError(res, "Could not share the document."));
        setAdding(false);
        return;
      }
      const data = await res.json();
      const person: Collaborator = data.share;
      setPeople((prev) =>
        prev.some((p) => p.userId === person.userId)
          ? prev.map((p) => (p.userId === person.userId ? person : p))
          : [...prev, person],
      );
      setNotice(
        res.status === 201
          ? `Shared with ${person.name} as ${ROLE_LABEL[person.role]}.`
          : `${person.name} already had access; role set to ${ROLE_LABEL[person.role]}.`,
      );
      setEmail("");
      emailRef.current?.focus();
    } catch {
      setAddError("Network error. Please try again.");
    }
    setAdding(false);
  }

  async function changeRole(person: Collaborator, next: Role) {
    setRowError(null);
    setBusyUser(person.userId);
    try {
      const res = await fetch(`/api/documents/${docId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: person.email, role: next }),
      });
      if (!res.ok) {
        setRowError({ userId: person.userId, message: await readError(res, "Could not change the role.") });
      } else {
        const data = await res.json();
        setPeople((prev) => prev.map((p) => (p.userId === person.userId ? data.share : p)));
      }
    } catch {
      setRowError({ userId: person.userId, message: "Network error. Please try again." });
    }
    setBusyUser(null);
  }

  async function remove(person: Collaborator) {
    setRowError(null);
    setBusyUser(person.userId);
    try {
      const res = await fetch(`/api/documents/${docId}/share`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: person.userId }),
      });
      // 404 means they already have no access; either way they are gone from the list.
      if (!res.ok && res.status !== 404) {
        setRowError({ userId: person.userId, message: await readError(res, "Could not remove access.") });
      } else {
        setPeople((prev) => prev.filter((p) => p.userId !== person.userId));
      }
    } catch {
      setRowError({ userId: person.userId, message: "Network error. Please try again." });
    }
    setBusyUser(null);
  }

  const field = "rounded border border-gray-400 bg-white px-3 py-2 text-base text-black";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={open}
        className="rounded border border-gray-500 px-3 py-1 text-sm"
      >
        Share
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="share-title"
        onClose={onClosed}
        onClick={onDialogClick}
        className="m-auto w-full max-w-md rounded-lg bg-white p-0 text-black shadow-xl backdrop:bg-black/50"
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <h2 id="share-title" className="text-lg font-semibold">
              Share document
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="rounded px-2 text-xl leading-none hover:bg-gray-200"
            >
              &times;
            </button>
          </div>

          <form onSubmit={add} className="mt-4 flex flex-col gap-3" noValidate>
            <label className="flex flex-col gap-1 text-sm">
              Email
              <input
                ref={emailRef}
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setAddError(null);
                  setNotice(null);
                }}
                autoComplete="off"
                placeholder="name@example.com"
                aria-invalid={addError ? true : undefined}
                aria-describedby={addError ? "share-add-error" : undefined}
                className={field}
              />
            </label>
            <div className="flex items-end gap-3">
              <label className="flex flex-1 flex-col gap-1 text-sm">
                Role
                <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={field}>
                  <option value="VIEWER">Viewer (can read)</option>
                  <option value="EDITOR">Editor (can edit)</option>
                </select>
              </label>
              <button
                type="submit"
                disabled={adding}
                className="rounded border border-gray-700 bg-black px-4 py-2 text-white disabled:opacity-50"
              >
                {adding ? "Adding…" : "Add"}
              </button>
            </div>
            {addError && (
              <p id="share-add-error" role="alert" className="text-sm text-red-700">
                {addError}
              </p>
            )}
            {notice && (
              <p role="status" className="text-sm text-green-800">
                {notice}
              </p>
            )}
          </form>

          <h3 className="mt-6 text-sm font-semibold">People with access</h3>
          {loading ? (
            <p className="mt-2 text-sm opacity-70">Loading…</p>
          ) : loadError ? (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {loadError}{" "}
              <button type="button" onClick={() => void load()} className="underline">
                Retry
              </button>
            </p>
          ) : people.length === 0 ? (
            <p className="mt-2 text-sm opacity-70">Only you have access so far.</p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-200">
              {people.map((p) => (
                <li key={p.userId} className="py-2">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="truncate text-xs opacity-70">{p.email}</p>
                    </div>
                    <select
                      aria-label={`Role for ${p.name}`}
                      value={p.role}
                      disabled={busyUser === p.userId}
                      onChange={(e) => void changeRole(p, e.target.value as Role)}
                      className="rounded border border-gray-400 bg-white px-2 py-1 text-sm text-black"
                    >
                      <option value="VIEWER">Viewer</option>
                      <option value="EDITOR">Editor</option>
                    </select>
                    <button
                      type="button"
                      disabled={busyUser === p.userId}
                      onClick={() => void remove(p)}
                      aria-label={`Remove ${p.name}`}
                      className="rounded border border-gray-400 px-2 py-1 text-sm disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                  {rowError?.userId === p.userId && (
                    <p role="alert" className="mt-1 text-xs text-red-700">
                      {rowError.message}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </dialog>
    </>
  );
}
