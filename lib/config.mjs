export function config() {
  const production =
    Boolean(process.env.VERCEL) || process.env.APP_ENV === "production";
  const database = process.env.DATABASE_URL || "sqlite:./db.next.sqlite3";
  const secret =
    process.env.SECRET_KEY || "local-only-nonhuman-development-secret";
  const origin = process.env.PUBLIC_URL || "http://localhost:5174";
  const url = new URL(origin);
  if (url.origin !== origin || url.username || url.password)
    throw new Error("PUBLIC_URL must be an origin");
  if (
    production &&
    (url.protocol !== "https:" ||
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      !/^postgres(ql)?:/.test(database) ||
      secret.length < 50 ||
      new Set(secret).size < 5 ||
      !process.env.RESEND_API_KEY ||
      !process.env.DEFAULT_FROM_EMAIL)
  ) {
    throw new Error(
      "Production requires HTTPS PUBLIC_URL, PostgreSQL, random SECRET_KEY and email credentials",
    );
  }
  return {
    production,
    database,
    secret,
    origin,
    demo: !production && process.env.DEMO_MODE === "1",
  };
}
