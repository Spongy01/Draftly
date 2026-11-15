// Dashboard (skeleton): signed-in check plus one real DB read
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import LogoutButton from "./LogoutButton";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ownedCount = await db.document.count({ where: { ownerId: user.id } });

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-4">Signed in as {user.name}</p>
      <p>
        You own {ownedCount} {ownedCount === 1 ? "document" : "documents"}
      </p>
      <div className="mt-6">
        <LogoutButton />
      </div>
    </main>
  );
}
