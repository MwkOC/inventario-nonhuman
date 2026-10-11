import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pbkdf2Sync, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { handleApi } from "../lib/api.mjs";
import { migrate } from "../lib/schema.mjs";
import { transaction, closeDatabase } from "../lib/db.mjs";
import {
  hashPassword,
  verifyPassword,
  validPassword,
  digest,
  randomToken,
  expiresIn,
} from "../lib/auth.mjs";
import { parsePeople, readPeopleFile } from "../lib/people.mjs";
import { readLegacy, importLegacy } from "../lib/legacy.mjs";
import { dispatchMail } from "../lib/mail.mjs";
import { config } from "../lib/config.mjs";

const directory = await mkdtemp(path.join(tmpdir(), "nonhuman-test-"));
if (
  process.env.TEST_DATABASE_URL &&
  !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith("_test")
)
  throw new Error("Tests require a dedicated database ending in _test");
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  `sqlite:${path.join(directory, "test.sqlite3")}`;
process.env.APP_ENV = "development";
delete process.env.VERCEL;
process.env.PUBLIC_URL = "http://localhost:5174";
process.env.DEMO_MODE = "0";
process.env.LOCAL_EMAIL_DIR = path.join(directory, "emails");
const password = "TestingLab2026!";
let encoded;
const tables = [
  "sessions",
  "access_tokens",
  "rate_limits",
  "mail_tasks",
  "mutations",
  "notifications",
  "events",
  "loans",
  "visits",
  "attendance",
  "items",
  "users",
];
before(async () => {
  await migrate();
  encoded = await hashPassword(password);
});
beforeEach(async () => {
  await transaction(async (db) => {
    for (const table of tables) await db.query(`DELETE FROM ${table}`);
    for (const [id, role] of [
      [1, "admin"],
      [2, "admin"],
      [3, "member"],
      [4, "external"],
    ])
      await db.query(
        "INSERT INTO users(id,dni,name,email,role,password) VALUES(?,?,?,?,?,?)",
        [
          id,
          String(10000000 + id),
          `Persona ${id}`,
          `p${id}@example.com`,
          role,
          encoded,
        ],
      );
    await db.query(
      "INSERT INTO items(id,code,name,category,location,total,available,consumable) VALUES(1,'CAM','Camara','Camaras','A1',3,3,0),(2,'CAB','Cable','Consumibles','A1',5,5,1)",
    );
    if (!db.sqlite) {
      await db.query(
        "SELECT setval(pg_get_serial_sequence('users','id'),5,false)",
      );
      await db.query(
        "SELECT setval(pg_get_serial_sequence('items','id'),3,false)",
      );
    }
  });
});
after(async () => {
  await closeDatabase();
  await rm(directory, { recursive: true, force: true });
});

function client() {
  const jar = {};
  let csrf = "";
  return {
    async call(action, body, options = {}) {
      const headers = new Headers({
        cookie: Object.entries(jar)
          .map(([k, v]) => `${k}=${v}`)
          .join("; "),
      });
      if (body !== undefined) {
        headers.set("content-type", "application/json");
        headers.set("origin", options.origin || process.env.PUBLIC_URL);
        headers.set("x-csrftoken", options.csrf === false ? "invalid" : csrf);
        headers.set("idempotency-key", options.key || randomUUID());
      }
      const request = new Request(`${process.env.PUBLIC_URL}/api/${action}`, {
        method: body === undefined ? "GET" : "POST",
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const response = await handleApi(request, action);
      for (const value of response.headers.getSetCookie()) {
        const [pair] = value.split(";"),
          i = pair.indexOf("=");
        jar[pair.slice(0, i)] = pair.slice(i + 1);
      }
      const data = await response.json();
      if (data.csrf) csrf = data.csrf;
      return { status: response.status, data, headers: response.headers };
    },
    async login(id = 3) {
      await this.call("session");
      const result = await this.call("login", {
        dni: String(10000000 + id),
        password,
      });
      assert.equal(result.status, 200, JSON.stringify(result.data));
      return this;
    },
  };
}
const loanBody = (items = [{ id: 1, quantity: 2 }]) => ({
  items,
  reason: "Proyecto",
  due: expiresIn(86400),
});
const rows = (table) =>
  transaction((db) =>
    db.query(
      `SELECT * FROM ${table} ORDER BY ${["sessions", "access_tokens"].includes(table) ? "token" : table === "rate_limits" ? "key" : "id"}`,
    ),
  );

test("private API, CSRF, hostile origin and uncached session", async () => {
  const c = client();
  assert.equal((await c.call("state")).status, 401);
  const session = await c.call("session");
  assert.match(session.headers.get("cache-control"), /no-store/);
  assert.match(session.headers.get("set-cookie"), /HttpOnly/);
  assert.equal(
    (await c.call("login", { dni: "10000003", password }, { csrf: false }))
      .status,
    403,
  );
  assert.equal(
    (
      await c.call(
        "login",
        { dni: "10000003", password },
        { origin: "https://evil.example" },
      )
    ).status,
    403,
  );
});
test("persistent session and logout", async () => {
  const c = await client().login();
  assert.equal((await c.call("session")).data.user.id, 3);
  await c.call("logout", {});
  assert.equal((await c.call("state")).status, 401);
});
test("expired sessions cannot access data", async () => {
  const c = await client().login();
  await transaction((db) =>
    db.query("UPDATE sessions SET expires=?", [expiresIn(-1)]),
  );
  assert.equal((await c.call("state")).status, 401);
});
test("stock management validates quantities and records history", async () => {
  const c = await client().login(1);
  assert.equal(
    (
      await c.call("item-create", {
        code: "NEW",
        name: "Nuevo",
        category: "Equipo",
        location: "A2",
        quantity: 2,
        minimum: 0,
        image: "https://example.com/item.jpg",
        consumable: false,
      })
    ).status,
    200,
  );
  const id = (await rows("items")).find((i) => i.code === "NEW").id;
  assert.equal(
    (
      await c.call("stock", {
        id,
        quantity: 3,
        operation: "remove",
        reason: "Baja",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await c.call("stock", {
        id,
        quantity: 1,
        operation: "add",
        reason: "Compra",
      })
    ).status,
    200,
  );
  assert.equal((await rows("items")).find((i) => i.id === id).total, 3);
  assert.equal((await rows("events")).length, 2);
});
test("member cannot close another host visit", async () => {
  const a = await client().login(1),
    c = await client().login();
  await a.call("visit-create", { name: "Invitado", reason: "Proyecto" });
  const id = (await rows("visits"))[0].id;
  assert.equal((await c.call("visit-close", { id })).status, 403);
  assert.equal((await a.call("visit-close", { id })).status, 200);
  assert.equal((await a.call("visit-close", { id })).status, 400);
});
test("rate limiting commits failed attempts", async () => {
  const c = client();
  await c.call("session");
  for (let i = 0; i < 5; i++)
    assert.equal(
      (await c.call("login", { dni: "10000003", password: "wrong" })).status,
      401,
    );
  assert.equal(
    (await c.call("login", { dni: "10000003", password })).status,
    429,
  );
});
test("checkout is idempotent and notifies every admin", async () => {
  const c = await client().login();
  assert.equal(
    (await c.call("checkout", loanBody(), { key: "same" })).status,
    200,
  );
  assert.equal(
    (await c.call("checkout", loanBody(), { key: "same" })).data.replayed,
    true,
  );
  assert.equal((await rows("items"))[0].available, 1);
  assert.equal((await rows("loans")).length, 1);
  assert.equal((await rows("notifications")).length, 2);
});
test("failed basket rolls back stock and mutation key", async () => {
  const c = await client().login();
  assert.equal(
    (
      await c.call(
        "checkout",
        loanBody([
          { id: 1, quantity: 2 },
          { id: 2, quantity: 6 },
        ]),
      )
    ).status,
    400,
  );
  assert.equal((await rows("items"))[0].available, 3);
  assert.equal((await rows("mutations")).length, 0);
  assert.equal((await rows("loans")).length, 0);
});
test("concurrent checkouts cannot oversell", async () => {
  const a = await client().login(1),
    b = await client().login(3);
  const results = await Promise.all([
    a.call("checkout", loanBody()),
    b.call("checkout", loanBody()),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
  assert.equal((await rows("items"))[0].available, 1);
});
test("concurrent retries create one loan", async () => {
  const c = await client().login();
  const results = await Promise.all([
    c.call("checkout", loanBody(), { key: "race" }),
    c.call("checkout", loanBody(), { key: "race" }),
  ]);
  assert.ok(results.every((r) => r.status === 200));
  assert.equal((await rows("loans")).length, 1);
});
test("partial, damaged, excess returns and repair", async () => {
  const c = await client().login();
  await c.call("checkout", loanBody());
  const id = (await rows("loans"))[0].id;
  assert.equal((await c.call("return", { id, quantity: 1 })).status, 200);
  assert.equal(
    (await c.call("return", { id, quantity: 1, damaged: true })).status,
    200,
  );
  assert.equal((await c.call("return", { id, quantity: 1 })).status, 400);
  const item = (await rows("items"))[0];
  assert.equal(item.available, 2);
  assert.equal(item.unavailable, 1);
  const admin = await client().login(1);
  assert.equal(
    (
      await admin.call("stock", {
        id: 1,
        quantity: 1,
        reason: "Reparado",
        operation: "repair",
      })
    ).status,
    200,
  );
  assert.equal((await rows("items"))[0].available, 3);
});
test("admin returns own loans but not another member loans", async () => {
  const c = await client().login(),
    admin = await client().login(1);
  await c.call("checkout", loanBody([{ id: 1, quantity: 1 }]));
  const id = (await rows("loans"))[0].id;
  assert.equal((await admin.call("return", { id, quantity: 1 })).status, 403);
  await admin.call("checkout", loanBody([{ id: 1, quantity: 1 }]));
  const own = (await rows("loans")).find((l) => l.user_id === 1);
  assert.equal(
    (await admin.call("return", { id: own.id, quantity: 1 })).status,
    200,
  );
});
test("consumables reduce total and cannot be returned", async () => {
  const c = await client().login();
  const result = await c.call("checkout", {
    items: [{ id: 2, quantity: 2 }],
    reason: "Soldadura",
  });
  assert.equal(result.status, 200);
  const loan = (await rows("loans"))[0];
  assert.equal(loan.due, null);
  assert.equal(
    (await c.call("return", { id: loan.id, quantity: 1 })).status,
    400,
  );
  const item = (await rows("items")).find((i) => i.id === 2);
  assert.equal(item.total, 3);
  assert.equal(item.available, 3);
});
test("external sees only own attendance and cannot borrow or manage", async () => {
  const c = await client().login(4);
  assert.equal((await c.call("check-in", {})).status, 200);
  assert.equal((await c.call("check-in", {})).status, 400);
  const state = (await c.call("state")).data;
  assert.equal(state.attendance.length, 1);
  assert.equal(state.items, undefined);
  assert.equal(state.people, undefined);
  for (const action of [
    "checkout",
    "visit-create",
    "person-create",
    "item-create",
    "notifications-read",
  ])
    assert.equal((await c.call(action, {})).status, 403);
  assert.equal((await c.call("check-out", {})).status, 200);
});
test("member cannot manage people; histories are scoped", async () => {
  const admin = await client().login(1);
  await admin.call("check-in", {});
  await admin.call("visit-create", { name: "Invitado", reason: "Proyecto" });
  const c = await client().login();
  assert.equal((await c.call("person-create", {})).status, 403);
  const state = (await c.call("state")).data;
  assert.equal(state.attendance.length, 0);
  assert.equal(state.visits.length, 0);
  assert.equal(state.people, undefined);
});
test("host checkout keeps visits open", async () => {
  const c = await client().login();
  await c.call("check-in", {});
  await c.call("visit-create", { name: "Visita", reason: "Proyecto" });
  assert.equal((await c.call("check-out", {})).data.open_visits, 1);
  assert.equal((await rows("visits"))[0].exited, null);
});
test("notification reads independent", async () => {
  const c = await client().login();
  await c.call("checkout", loanBody());
  const admin = await client().login(1);
  await admin.call("notifications-read", {});
  const notifications = await rows("notifications");
  assert.equal(notifications.find((n) => n.recipient_id === 1).read, 1);
  assert.equal(notifications.find((n) => n.recipient_id === 2).read, 0);
});
test("deactivation and reactivation revoke old sessions and passwords", async () => {
  const c = await client().login(),
    admin = await client().login(1);
  await admin.call("person-toggle", { id: 3 });
  assert.equal((await c.call("state")).status, 401);
  await admin.call("person-toggle", { id: 3 });
  assert.equal((await c.call("state")).status, 401);
  assert.equal((await rows("users")).find((u) => u.id === 3).password, "!");
  assert.equal((await admin.call("person-toggle", { id: 1 })).status, 400);
});
test("activation token single-use, password policy and revocation", async () => {
  const old = await client().login(),
    c = client();
  await c.call("session");
  const token = randomToken();
  await transaction((db) =>
    db.query("INSERT INTO access_tokens(token,user_id,expires) VALUES(?,?,?)", [
      digest(token),
      3,
      expiresIn(3600),
    ]),
  );
  const body = {
    uid: Buffer.from("3").toString("base64url"),
    token,
    password: "NewSecureSecret2026!",
  };
  assert.equal(
    (await c.call("set-password", { ...body, password: "1234567890" })).status,
    400,
  );
  assert.equal((await c.call("set-password", body)).status, 200);
  assert.equal((await c.call("set-password", body)).status, 400);
  assert.equal((await old.call("state")).status, 401);
});
test("expired activation token rejected", async () => {
  const c = client();
  await c.call("session");
  const token = randomToken();
  await transaction((db) =>
    db.query("INSERT INTO access_tokens(token,user_id,expires) VALUES(?,?,?)", [
      digest(token),
      3,
      expiresIn(-1),
    ]),
  );
  assert.equal(
    (
      await c.call("set-password", {
        uid: Buffer.from("3").toString("base64url"),
        token,
        password: "NewSecureSecret2026!",
      })
    ).status,
    400,
  );
});
test("Django PBKDF2 password verified and upgraded at login", async () => {
  const legacy = `pbkdf2_sha256$10000$salt$${pbkdf2Sync(password, "salt", 10000, 32, "sha256").toString("base64")}`;
  assert.equal(await verifyPassword(password, legacy), true);
  assert.equal(await verifyPassword("wrong", legacy), false);
  await transaction((db) =>
    db.query("UPDATE users SET password=? WHERE id=3", [legacy]),
  );
  await client().login();
  assert.match(
    (await rows("users")).find((u) => u.id === 3).password,
    /^scrypt\$/,
  );
});
test("person creation queues invitation without shared password", async () => {
  const c = await client().login(1);
  assert.equal(
    (
      await c.call("person-create", {
        dni: "12345678",
        name: "Nueva Persona",
        email: "new@example.com",
        role: "member",
      })
    ).status,
    200,
  );
  const user = (await rows("users")).find((u) => u.dni === "12345678");
  assert.equal(user.password, "!");
  await dispatchMail();
  assert.equal((await rows("access_tokens")).length, 1);
  assert.ok((await rows("mail_tasks"))[0].sent);
});
test("recovery is generic and throttles invitations", async () => {
  const c = client();
  await c.call("session");
  assert.deepEqual(
    (await c.call("recover", { email: "missing@example.com" })).data,
    { ok: true },
  );
  await c.call("recover", { email: "p3@example.com" });
  await c.call("recover", { email: "p3@example.com" });
  assert.equal((await rows("mail_tasks")).length, 1);
});
test("roster validates split names, duplicates and roles", async () => {
  const parsed = await transaction((db) =>
    parsePeople(db, [
      {
        Nombres: "Ana Maria ",
        Apellidos: " Perez ",
        DNI: 12345678,
        Correo: " ANA@example.com ",
      },
      { dni: "12345678", name: "Otra", email: "other@example.com" },
    ]),
  );
  assert.equal(parsed[0].name, "Ana Maria Perez");
  assert.equal(parsed[0].email, "ana@example.com");
  assert.equal(parsed[0].error, "");
  assert.ok(parsed[1].error);
});
test("CSV parsing handles quoted commas; invalid Excel rejected", async () => {
  const data = await readPeopleFile(
    Buffer.from('dni,nombre,correo\n12345678,"Ana, Perez",ana@example.com\n'),
    "roster.csv",
  );
  assert.equal(data[0].nombre, "Ana, Perez");
  await assert.rejects(readPeopleFile(Buffer.from("invalid"), "roster.xlsx"));
});
test("invalid payload shapes and duplicate items rejected", async () => {
  const c = await client().login();
  assert.equal(
    (await c.call("checkout", { items: ["invalid"], reason: "Proyecto" }))
      .status,
    400,
  );
  assert.equal(
    (
      await c.call(
        "checkout",
        loanBody([
          { id: 1, quantity: 1 },
          { id: 1, quantity: 1 },
        ]),
      )
    ).status,
    400,
  );
  assert.equal(
    (await c.call("checkout", loanBody([{ id: 1, quantity: true }]))).status,
    400,
  );
});
test("invalid import rolls back all accounts", async () => {
  const c = await client().login(1);
  assert.equal(
    (
      await c.call("import-people", {
        rows: [
          { dni: "12345678", name: "Valid", email: "valid@example.com" },
          { dni: "bad", name: "Invalid", email: "invalid@example.com" },
        ],
      })
    ).status,
    400,
  );
  assert.equal((await rows("users")).length, 4);
});
test("production configuration fails closed", () => {
  const saved = { ...process.env };
  try {
    process.env.VERCEL = "1";
    assert.throws(() => config());
  } finally {
    delete process.env.VERCEL;
    Object.assign(process.env, saved);
  }
});
test("legacy migration refuses nonempty destinations", async () => {
  await assert.rejects(importLegacy({ users: [] }));
  assert.equal((await rows("users")).length, 4);
});
test("legacy SQLite import preserves IDs, hashes and source bytes", async () => {
  const c = await client().login();
  await c.call("checkout", loanBody());
  await c.call("check-in", {});
  await c.call("visit-create", { name: "Visita", reason: "Proyecto" });
  await transaction((db) =>
    db.query("INSERT INTO mail_tasks(user_id,created) VALUES(3,?)", [
      new Date().toISOString(),
    ]),
  );
  const hash = `pbkdf2_sha256$10000$salt$${pbkdf2Sync(password, "salt", 10000, 32, "sha256").toString("base64")}`;
  await transaction((db) => db.query("UPDATE users SET password=?", [hash]));
  const filename = path.join(directory, "legacy.sqlite3"),
    legacy = new DatabaseSync(filename);
  const sourceMap = {
    users: "lab_user",
    items: "lab_item",
    attendance: "lab_attendance",
    visits: "lab_visit",
    loans: "lab_loan",
    events: "lab_event",
    notifications: "lab_notification",
    mutations: "lab_mutation",
    mail_tasks: "lab_mailtask",
  };
  const originals = {};
  for (const [table, name] of Object.entries(sourceMap)) {
    const records = await rows(table);
    originals[table] = records;
    let fields =
      table === "users"
        ? {
            id: "id",
            dni: "username",
            name: "first_name",
            email: "email",
            role: "role",
            active: "is_active",
            password: "password",
          }
        : Object.fromEntries(
            (records.length ? Object.keys(records[0]) : ["id"]).map((k) => [
              k,
              k,
            ]),
          );
    legacy.exec(
      `CREATE TABLE ${name}(${Object.entries(fields)
        .map(
          ([key, col]) =>
            `${col} ${typeof records[0]?.[key] === "number" ? "INTEGER" : "TEXT"}`,
        )
        .join(",")})`,
    );
    for (const row of records)
      legacy
        .prepare(
          `INSERT INTO ${name} VALUES(${Object.keys(fields)
            .map(() => "?")
            .join(",")})`,
        )
        .run(...Object.keys(fields).map((k) => row[k]));
  }
  legacy.close();
  const beforeBytes = await readFile(filename);
  const imported = readLegacy(filename);
  assert.equal(imported.users.length, 4);
  await transaction(async (db) => {
    for (const table of tables) await db.query(`DELETE FROM ${table}`);
  });
  await importLegacy(imported);
  assert.equal((await rows("users")).length, 4);
  assert.equal((await rows("items")).length, 2);
  for (const table of Object.keys(sourceMap))
    assert.deepEqual(
      JSON.parse(JSON.stringify(await rows(table))),
      JSON.parse(JSON.stringify(originals[table])),
    );
  assert.equal((await rows("sessions")).length, 0);
  assert.equal((await rows("access_tokens")).length, 0);
  assert.deepEqual(await readFile(filename), beforeBytes);
});

test("password reset preserves chosen spaces and rejects whitespace-only passwords", async () => {
  const c = client();
  await c.call("session");
  const token = randomToken();
  await transaction((db) =>
    db.query("INSERT INTO access_tokens(token,user_id,expires) VALUES(?,?,?)", [
      digest(token),
      3,
      expiresIn(3600),
    ]),
  );
  const chosen = "  AnotherSecurePhrase2026!  ";
  assert.equal(
    validPassword("            ", {
      dni: "10000003",
      email: "p3@example.com",
      name: "Persona",
    }),
    false,
  );
  const result = await c.call("set-password", {
    uid: Buffer.from("3").toString("base64url"),
    token,
    password: chosen,
  });
  assert.equal(result.status, 200);
  const user = (await rows("users")).find((row) => row.id === 3);
  assert.equal(await verifyPassword(chosen, user.password), true);
  assert.equal(await verifyPassword(chosen.trim(), user.password), false);
});

test("failed email delivery preserves the previous access link until a retry succeeds", async () => {
  const oldToken = digest(randomToken());
  await transaction(async (db) => {
    await db.query(
      "INSERT INTO access_tokens(token,user_id,expires) VALUES(?,?,?)",
      [oldToken, 3, expiresIn(1800)],
    );
    await db.query("INSERT INTO mail_tasks(user_id,created) VALUES(3,?)", [
      new Date().toISOString(),
    ]);
  });
  const normalDirectory = process.env.LOCAL_EMAIL_DIR;
  const blocked = path.join(directory, "blocked-mail-directory");
  await writeFile(blocked, "not a directory");
  try {
    process.env.LOCAL_EMAIL_DIR = blocked;
    await dispatchMail();
    assert.ok(
      (await rows("access_tokens")).some((row) => row.token === oldToken),
    );
    assert.equal((await rows("mail_tasks"))[0].sent, null);
  } finally {
    process.env.LOCAL_EMAIL_DIR = normalDirectory;
  }
  await dispatchMail();
  assert.ok((await rows("mail_tasks"))[0].sent);
  assert.equal((await rows("access_tokens")).length, 1);
  assert.notEqual((await rows("access_tokens"))[0].token, oldToken);
});

test("another pending email cannot overtake an active delivery for the same user", async () => {
  await transaction(async (db) => {
    await db.query(
      "INSERT INTO mail_tasks(user_id,created,lease) VALUES(3,?,?)",
      [new Date().toISOString(), expiresIn(120)],
    );
    await db.query("INSERT INTO mail_tasks(user_id,created) VALUES(3,?)", [
      new Date().toISOString(),
    ]);
  });
  await dispatchMail();
  assert.equal((await rows("mail_tasks"))[1].attempts, 0);
  assert.equal((await rows("access_tokens")).length, 0);
});
