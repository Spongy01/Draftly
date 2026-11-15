// Demo accounts shown on the login page and created by prisma/seed.ts (public test data only)
export const DEMO_PASSWORD = "Draftly!2026";

export const DEMO_ACCOUNTS = [
  { email: "alice@draftly.test", name: "Alice" },
  { email: "bob@draftly.test", name: "Bob" },
  { email: "carol@draftly.test", name: "Carol" },
] as const;
