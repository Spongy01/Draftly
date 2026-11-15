"use client";

// TipTap editor. StarterKit is trimmed to exactly what the server sanitizer allows
// (p, h1-h3, strong, em, u, ul, ol, li, br) so saved content is never silently altered.
// Content is loaded once from `initialHtml` and then owned by the editor; server responses
// are never pushed back in, so typing can't be overwritten.
import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Toolbar from "./Toolbar";

type Props = {
  initialHtml: string;
  editable: boolean;
  onUpdate?: (html: string) => void;
  onBlur?: () => void;
};

export default function Editor({ initialHtml, editable, onUpdate, onBlur }: Props) {
  // Keep the latest callbacks in refs so the editor instance is created only once.
  const onUpdateRef = useRef(onUpdate);
  const onBlurRef = useRef(onBlur);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onBlurRef.current = onBlur;
  });

  const editor = useEditor({
    immediatelyRender: false, // required for Next.js SSR
    editable,
    content: initialHtml,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // Disabled: the sanitizer would strip these, so the editor must not produce them.
        code: false,
        codeBlock: false,
        blockquote: false,
        strike: false,
        horizontalRule: false,
        link: false,
        // Underline is bundled in StarterKit (v3) and stays enabled.
      }),
    ],
    editorProps: {
      attributes: {
        class: "ProseMirror focus:outline-none",
        "aria-label": editable ? "Document content" : "Document content (read only)",
        "aria-readonly": editable ? "false" : "true",
      },
    },
    onUpdate: ({ editor }) => onUpdateRef.current?.(editor.getHTML()),
    onBlur: () => onBlurRef.current?.(),
  });

  return (
    <div className="rounded border border-gray-400/60">
      {editable && editor && <Toolbar editor={editor} />}
      <div className="min-h-64 px-4 py-3">
        {editor ? <EditorContent editor={editor} /> : <p className="text-sm opacity-60">Loading editor…</p>}
      </div>
    </div>
  );
}
