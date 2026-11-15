type Props = { access: "owner" | "editor" | "viewer" };

const STYLES = {
  owner: "bg-emerald-100 text-emerald-800",
  editor: "bg-blue-100 text-blue-800",
  viewer: "bg-amber-100 text-amber-800",
} as const;

const LABELS = { owner: "Owner", editor: "Editor", viewer: "Viewer" } as const;

export default function RoleBadge({ access }: Props) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[access]}`}>
      {LABELS[access]}
    </span>
  );
}
