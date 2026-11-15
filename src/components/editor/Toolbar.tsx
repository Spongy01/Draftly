"use client";

import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";

type BtnProps = {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function Btn({ label, active, onClick, children }: BtnProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      // Keep the editor selection/focus when clicking a toolbar button.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`min-w-8 rounded px-2 py-1 text-sm ${
        active ? "bg-gray-500/40 font-semibold" : "hover:bg-gray-500/20"
      }`}
    >
      {children}
    </button>
  );
}

export default function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      underline: editor.isActive("underline"),
      p: editor.isActive("paragraph"),
      h1: editor.isActive("heading", { level: 1 }),
      h2: editor.isActive("heading", { level: 2 }),
      h3: editor.isActive("heading", { level: 3 }),
      bullet: editor.isActive("bulletList"),
      ordered: editor.isActive("orderedList"),
    }),
  });

  const chain = () => editor.chain().focus();

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-1 border-b border-gray-400/60 px-2 py-1.5">
      <Btn label="Bold" active={s.bold} onClick={() => chain().toggleBold().run()}>
        <span className="font-bold">B</span>
      </Btn>
      <Btn label="Italic" active={s.italic} onClick={() => chain().toggleItalic().run()}>
        <span className="italic">I</span>
      </Btn>
      <Btn label="Underline" active={s.underline} onClick={() => chain().toggleUnderline().run()}>
        <span className="underline">U</span>
      </Btn>
      <span className="mx-1 h-5 w-px bg-gray-400/60" aria-hidden />
      <Btn label="Paragraph" active={s.p} onClick={() => chain().setParagraph().run()}>
        P
      </Btn>
      <Btn label="Heading 1" active={s.h1} onClick={() => chain().toggleHeading({ level: 1 }).run()}>
        H1
      </Btn>
      <Btn label="Heading 2" active={s.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
        H2
      </Btn>
      <Btn label="Heading 3" active={s.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()}>
        H3
      </Btn>
      <span className="mx-1 h-5 w-px bg-gray-400/60" aria-hidden />
      <Btn label="Bullet list" active={s.bullet} onClick={() => chain().toggleBulletList().run()}>
        &bull; List
      </Btn>
      <Btn label="Numbered list" active={s.ordered} onClick={() => chain().toggleOrderedList().run()}>
        1. List
      </Btn>
    </div>
  );
}
