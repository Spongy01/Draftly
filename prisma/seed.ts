// Idempotent seed: three demo users and one shared sample document
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "../src/lib/demo-accounts";
import { sanitizeContent } from "../src/lib/sanitize";

const prisma = new PrismaClient();

const SAMPLE_DOC_ID = "welcome-to-draftly";
const SAMPLE_DOC_HTML = sanitizeContent(
  [
    "<h1>Welcome to Draftly</h1>",
    "<p>This is a sample document. Use the toolbar for <strong>bold</strong>, <em>italic</em> and <u>underline</u>, and switch between headings and lists.</p>",
    "<h2>Things to try</h2>",
    "<ul>",
    "<li><p>Edit this text and watch the indicator change from Saving to Saved.</p></li>",
    "<li><p>Click Share to give someone access as a viewer or an editor.</p></li>",
    "<li><p>Go back to the dashboard and use Import file to turn a .txt, .md or .docx into a document.</p></li>",
    "</ul>",
    "<h3>To see sharing in action</h3>",
    "<ol>",
    "<li><p>Open this document in a private window as bob@draftly.test (viewer) or carol@draftly.test (editor).</p></li>",
    "<li><p>Change their role from the Share dialog and reload their window.</p></li>",
    "</ol>",
  ].join(""),
);

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const users = new Map<string, string>();
  for (const u of DEMO_ACCOUNTS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, passwordHash },
      create: { ...u, passwordHash },
    });
    users.set(u.email, user.id);
  }
  console.log("Seeded users (password for all):", DEMO_PASSWORD);
  for (const u of DEMO_ACCOUNTS) console.log(`  ${u.email}`);

  const alice = users.get("alice@draftly.test")!;
  const bob = users.get("bob@draftly.test")!;
  const carol = users.get("carol@draftly.test")!;

  // Empty `update` everywhere: re-running the seed never overwrites reviewers' edits,
  // role changes, or shares they changed. Missing rows are recreated.
  await prisma.document.upsert({
    where: { id: SAMPLE_DOC_ID },
    update: {},
    create: {
      id: SAMPLE_DOC_ID,
      title: "Welcome to Draftly",
      contentHtml: SAMPLE_DOC_HTML,
      ownerId: alice,
    },
  });

  for (const [userId, role] of [
    [bob, "VIEWER"],
    [carol, "EDITOR"],
  ] as const) {
    await prisma.share.upsert({
      where: { documentId_userId: { documentId: SAMPLE_DOC_ID, userId } },
      update: {},
      create: { documentId: SAMPLE_DOC_ID, userId, role },
    });
  }
  console.log('Sample document ensured: "Welcome to Draftly" (Alice owns; Bob viewer, Carol editor)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
