import { readFile } from "node:fs/promises";
import { migrate } from "../lib/schema.mjs";
import { transaction, closeDatabase } from "../lib/db.mjs";
import { readLegacy, importLegacy } from "../lib/legacy.mjs";
import {
  parsePeople,
  readPeopleFile,
  createPerson,
  queueMail,
} from "../lib/people.mjs";
import { dispatchMail } from "../lib/mail.mjs";
import { seedDemo } from "../lib/demo.mjs";

const [command, ...args] = process.argv.slice(2);
try {
  if (command === "migrate") await migrate();
  else if (command === "seed-demo") await seedDemo();
  else if (command === "import-legacy") {
    const rows = readLegacy(args[0]);
    console.log(
      Object.fromEntries(
        Object.entries(rows).map(([table, data]) => [table, data.length]),
      ),
    );
    if (args.includes("--apply")) {
      await importLegacy(rows);
      console.log(
        "Migration complete. Source unchanged; sessions and links must be renewed.",
      );
    } else
      console.log(
        "Validation only. Run db:migrate on an empty destination, then repeat with --apply.",
      );
  } else if (command === "bootstrap") {
    await transaction(async (db) => {
      if (await db.one("SELECT id FROM users WHERE role='admin' AND active=1"))
        return;
      const [row] = await parsePeople(db, [
        {
          dni: process.env.BOOTSTRAP_ADMIN_DNI,
          email: process.env.BOOTSTRAP_ADMIN_EMAIL,
          name: process.env.BOOTSTRAP_ADMIN_NAME,
          role: "admin",
        },
      ]);
      if (row.error)
        throw new Error("Configure valid BOOTSTRAP_ADMIN_DNI, EMAIL and NAME");
      await createPerson(db, row);
    });
    console.log("Administrator available; new invitations remain queued.");
  } else if (command === "import-members") {
    const rows = await readPeopleFile(await readFile(args[0]), args[0]);
    const admins = new Set(
      args.flatMap((value, index) =>
        value === "--admin-dni" ? [args[index + 1]] : [],
      ),
    );
    await transaction(async (db) => {
      const parsed = await parsePeople(
        db,
        rows,
        args.includes("--skip-existing"),
      );
      if (
        !admins.size ||
        [...admins].some((id) => !parsed.some((row) => row.dni === id)) ||
        parsed.some((row) => row.error)
      )
        throw new Error("Invalid roster or administrator selection");
      const pending = [];
      for (const row of parsed) {
        row.role = admins.has(row.dni) ? "admin" : "member";
        const existing = await db.one("SELECT * FROM users WHERE dni=?", [
          row.dni,
        ]);
        if (existing) {
          if (
            !args.includes("--skip-existing") ||
            !existing.active ||
            existing.name !== row.name ||
            existing.email.toLowerCase() !== row.email ||
            existing.role !== row.role
          )
            throw new Error("Existing account differs; nothing changed");
        } else {
          if (
            await db.one("SELECT id FROM users WHERE lower(email)=?", [
              row.email,
            ])
          )
            throw new Error("Email already assigned");
          pending.push(row);
        }
      }
      if (args.includes("--apply"))
        for (const row of pending) await createPerson(db, row);
      console.log(
        `${pending.length} new accounts; ${parsed.length - pending.length} preserved. ${args.includes("--apply") ? "Applied; invitations queued." : "Validation only."}`,
      );
    });
  } else if (command === "queue-access") {
    if (!args.includes("--apply"))
      throw new Error(
        "Use queue-access --apply to queue fresh invitations for active accounts without a password",
      );
    await transaction(async (db) => {
      const users = await db.query(
        "SELECT id FROM users WHERE active=1 AND password LIKE '!%' AND NOT EXISTS(SELECT 1 FROM mail_tasks m WHERE m.user_id=users.id AND m.sent IS NULL)",
      );
      for (const user of users) await queueMail(db, user.id);
      console.log(`${users.length} invitations queued.`);
    });
  } else if (command === "send-mail") await dispatchMail(100);
  else if (command === "cleanup")
    await transaction(async (db) => {
      const now = new Date().toISOString();
      for (const table of ["sessions", "access_tokens", "rate_limits"])
        await db.query(`DELETE FROM ${table} WHERE expires<=?`, [now]);
    });
  else
    throw new Error(
      "Commands: migrate, seed-demo, import-legacy, bootstrap, import-members, queue-access, send-mail, cleanup",
    );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
