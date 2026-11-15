// Idempotent seed: three test users sharing one password
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = "Draftly!2026";
const USERS = [
  { email: "alice@draftly.test", name: "Alice" },
  { email: "bob@draftly.test", name: "Bob" },
  { email: "carol@draftly.test", name: "Carol" },
];

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  for (const u of USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, passwordHash },
      create: { ...u, passwordHash },
    });
  }
  console.log("Seeded users (password for all):", PASSWORD);
  for (const u of USERS) console.log(`  ${u.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
