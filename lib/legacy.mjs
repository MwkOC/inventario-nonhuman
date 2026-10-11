import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { config } from "./config.mjs";
import { transaction } from "./db.mjs";

const mappings = {
  users: [
    "lab_user",
    {
      id: "id",
      dni: "username",
      name: "first_name",
      email: "email",
      role: "role",
      active: "is_active",
      password: "password",
    },
  ],
  items: ["lab_item", null],
  attendance: ["lab_attendance", null],
  visits: ["lab_visit", null],
  loans: ["lab_loan", null],
  events: ["lab_event", null],
  notifications: ["lab_notification", null],
  mutations: ["lab_mutation", null],
  mail_tasks: ["lab_mailtask", null],
};
const dateColumns = new Set(["entered", "exited", "due", "created", "sent"]);
export function readLegacy(filename) {
  if (
    config().database.startsWith("sqlite:") &&
    path.resolve(filename) === path.resolve(config().database.slice(7))
  )
    throw new Error("Source and destination must differ");
  const source = new DatabaseSync(filename, { readOnly: true });
  try {
    source.exec("BEGIN");
    const result = {};
    for (const [target, [table, mapping]] of Object.entries(mappings)) {
      result[target] = source
        .prepare(`SELECT * FROM ${table} ORDER BY id`)
        .all()
        .map((raw) => {
          const row = mapping
            ? Object.fromEntries(
                Object.entries(mapping).map(([key, value]) => [
                  key,
                  raw[value],
                ]),
              )
            : { ...raw };
          if (
            target === "users" &&
            row.password &&
            !row.password.startsWith("!") &&
            !/^pbkdf2_sha256\$\d+\$/.test(row.password)
          )
            throw new Error(
              "Unsupported legacy password algorithm; aborting without changes",
            );
          for (const key of dateColumns)
            if (row[key]) {
              const value = String(row[key]).replace(" ", "T");
              row[key] = new Date(
                /[zZ]$|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`,
              ).toISOString();
            }
          return row;
        });
    }
    return result;
  } finally {
    source.close();
  }
}

export async function importLegacy(rows) {
  await transaction(async (db) => {
    for (const table of Object.keys(mappings)) {
      if (
        Number((await db.one(`SELECT count(*) AS count FROM ${table}`)).count)
      )
        throw new Error("Destination must be empty; no records were changed");
    }
    for (const [table, records] of Object.entries(rows)) {
      for (const row of records) {
        const columns = Object.keys(row);
        await db.query(
          `INSERT INTO ${table}(${columns.join(",")}) VALUES(${columns.map(() => "?").join(",")})`,
          Object.values(row),
        );
      }
      if (!db.sqlite)
        await db.query(
          `SELECT setval(pg_get_serial_sequence('${table}','id'),COALESCE((SELECT MAX(id) FROM ${table}),0)+1,false)`,
        );
      const actual = Number(
        (await db.one(`SELECT count(*) AS count FROM ${table}`)).count,
      );
      if (actual !== records.length)
        throw new Error("Migration count mismatch");
    }
    // Sessions and activation tokens intentionally do not migrate between authentication systems.
  });
}
