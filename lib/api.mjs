import { transaction } from "./db.mjs";
import { config } from "./config.mjs";
import {
  csrfToken,
  validCsrf,
  equal,
  digest,
  randomToken,
  currentUser,
  expiresIn,
  SESSION_AGE,
  verifyPassword,
  hashPassword,
  validPassword,
  rateLimit,
} from "./auth.mjs";
import { ApiError, requireValue as require, person } from "./validation.mjs";
import { parsePeople, readPeopleFile, queueMail } from "./people.mjs";
import { snapshot, mutate } from "./lab.mjs";

function cookies(request) {
  return Object.fromEntries(
    (request.headers.get("cookie") || "").split(";").map((part) => {
      const i = part.indexOf("=");
      return [part.slice(0, i).trim(), part.slice(i + 1)];
    }),
  );
}
function cookie(name, value, age, secure) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure ? "; Secure" : ""}`;
}
async function boundedBody(request) {
  const maximum = 3 * 1024 * 1024;
  require(Number(request.headers.get("content-length") || 0) <=
    maximum, "Solicitud demasiado grande.", 413);
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader(),
    chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maximum) {
      await reader.cancel();
      throw new ApiError("Solicitud demasiado grande.", 413);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function handleApi(request, action) {
  const headers = new Headers({
    "Cache-Control": "no-store, private",
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  });
  try {
    const c = config(),
      jar = cookies(request);
    const sessionName = c.production ? "__Host-nh_session" : "nh_session";
    const csrfName = c.production ? "__Host-nh_csrf" : "nh_csrf";
    let csrf = validCsrf(jar[csrfName]) ? jar[csrfName] : csrfToken();
    if (request.method === "POST") {
      const origin = request.headers.get("origin");
      require(origin === c.origin, "Origen no autorizado.", 403);
      require(validCsrf(jar[csrfName]) &&
        equal(
          request.headers.get("x-csrftoken"),
          jar[csrfName],
        ), "Sesion de formulario vencida. Recarga la pagina.", 403);
    } else require(request.method === "GET", "Metodo no permitido.", 405);
    let data = {},
      fileRows;
    if (request.method === "POST") {
      const body = await boundedBody(request);
      if (action === "import-preview") {
        // Authenticate before parsing the potentially expensive workbook.
        const user = await transaction((db) =>
          currentUser(db, jar[sessionName]),
        );
        require(user?.role === "admin", "No autorizado.", 403);
        let form;
        try {
          form = await new Request(request.url, {
            method: "POST",
            headers: {
              "Content-Type": request.headers.get("content-type") || "",
            },
            body,
          }).formData();
        } catch {
          throw new ApiError("Formulario de archivo invalido.");
        }
        const file = form.get("file");
        require(file &&
          typeof file.arrayBuffer === "function" &&
          file.size <=
            2 * 1024 * 1024, "Selecciona un XLSX o CSV de hasta 2 MB.");
        fileRows = await readPeopleFile(
          Buffer.from(await file.arrayBuffer()),
          file.name,
        );
      } else {
        require(request.headers
          .get("content-type")
          ?.startsWith("application/json"), "Usa JSON.");
        try {
          data = JSON.parse(body.toString() || "{}");
        } catch {
          throw new ApiError("JSON invalido.");
        }
        require(data &&
          typeof data === "object" &&
          !Array.isArray(data), "Solicitud invalida.");
      }
    }
    const result = await transaction(async (db) => {
      const user = await currentUser(db, jar[sessionName]);
      const now = new Date().toISOString();
      if (user) {
        await db.query("UPDATE sessions SET expires=? WHERE token=?", [
          expiresIn(SESSION_AGE),
          digest(jar[sessionName]),
        ]);
        headers.append(
          "Set-Cookie",
          cookie(sessionName, jar[sessionName], SESSION_AGE, c.production),
        );
      }
      if (request.method === "GET") {
        if (action === "session") {
          headers.append(
            "Set-Cookie",
            cookie(csrfName, csrf, SESSION_AGE, c.production),
          );
          return { csrf, user: user ? person(user) : null, demo: c.demo };
        }
        require(user, "Inicia sesion para continuar.", 401);
        require(action === "state", "No encontrado.", 404);
        return snapshot(db, user);
      }
      if (action === "login") {
        const dni = typeof data.dni === "string" ? data.dni.trim() : "";
        const key = `login:${digest(dni)}`;
        const ip = process.env.VERCEL
          ? request.headers.get("x-vercel-forwarded-for") || "unknown"
          : "local";
        const allowed = await rateLimit(db, key, 5, 900);
        const ipAllowed = await rateLimit(
          db,
          `login-ip:${digest(ip)}`,
          100,
          900,
        );
        if (!allowed || !ipAllowed)
          return {
            error: "Demasiados intentos. Intenta nuevamente en 15 minutos.",
            status: 429,
          };
        const target = await db.one(
          "SELECT * FROM users WHERE dni=? AND active=1",
          [dni],
        );
        const fallback =
          "scrypt$131072$nonhuman-dummy-salt$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
        const verified = await verifyPassword(
          data.password,
          target?.password?.startsWith("!")
            ? fallback
            : target?.password || fallback,
        );
        if (!verified)
          return { error: "DNI o contrasena incorrectos.", status: 401 };
        if (jar[sessionName])
          await db.query("DELETE FROM sessions WHERE token=?", [
            digest(jar[sessionName]),
          ]);
        await db.query("DELETE FROM rate_limits WHERE key=?", [key]);
        const token = randomToken();
        await db.query(
          "INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)",
          [digest(token), target.id, expiresIn(SESSION_AGE)],
        );
        // Upgrade a legacy Django password after successful verification.
        if (!target.password.startsWith("scrypt$131072$"))
          await db.query("UPDATE users SET password=? WHERE id=?", [
            await hashPassword(data.password),
            target.id,
          ]);
        csrf = csrfToken();
        headers.append(
          "Set-Cookie",
          cookie(sessionName, token, SESSION_AGE, c.production),
        );
        headers.append(
          "Set-Cookie",
          cookie(csrfName, csrf, SESSION_AGE, c.production),
        );
        return { user: person(target), csrf };
      }
      if (action === "logout") {
        if (jar[sessionName])
          await db.query("DELETE FROM sessions WHERE token=?", [
            digest(jar[sessionName]),
          ]);
        headers.append("Set-Cookie", cookie(sessionName, "", 0, c.production));
        return { ok: true };
      }
      if (action === "recover") {
        const email =
          typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
        const target = await db.one(
          "SELECT id FROM users WHERE lower(email)=? AND active=1",
          [email],
        );
        const recent = new Date(Date.now() - 900000).toISOString();
        if (
          target &&
          !(await db.one(
            "SELECT id FROM mail_tasks WHERE user_id=? AND created>?",
            [target.id, recent],
          )) &&
          Number(
            (
              await db.one(
                "SELECT count(*) AS count FROM mail_tasks WHERE created>?",
                [recent],
              )
            ).count,
          ) < 30
        )
          await queueMail(db, target.id);
        return { ok: true };
      }
      if (action === "set-password") {
        const uid = Buffer.from(
          typeof data.uid === "string" ? data.uid : "",
          "base64url",
        ).toString();
        const token = typeof data.token === "string" ? data.token : "";
        require(/^\d+$/.test(uid) &&
          Number(uid) > 0 &&
          Number(uid) <= 2147483647 &&
          /^[a-f0-9]{64}$/.test(token), "Enlace invalido o vencido.");
        const target = await db.one(
          "SELECT u.* FROM users u JOIN access_tokens a ON a.user_id=u.id WHERE a.token=? AND a.expires>? AND u.id=? AND u.active=1",
          [digest(token), now, Number(uid)],
        );
        require(target, "Enlace invalido o vencido.");
        const password = data.password;
        require(validPassword(
          password,
          target,
        ), "Usa de 10 a 128 caracteres, una contrasena no comun y sin tus datos personales.");
        await db.query("UPDATE users SET password=? WHERE id=?", [
          await hashPassword(password),
          target.id,
        ]);
        await db.query("DELETE FROM access_tokens WHERE user_id=?", [
          target.id,
        ]);
        await db.query("DELETE FROM sessions WHERE user_id=?", [target.id]);
        return { ok: true };
      }
      require(user, "Inicia sesion para continuar.", 401);
      if (action === "import-preview") {
        require(user.role === "admin", "No autorizado.", 403);
        return { rows: await parsePeople(db, fileRows) };
      }
      const key = request.headers.get("idempotency-key");
      require(key && key.length <= 64, "Falta identificador de operacion.");
      if (
        await db.one("SELECT id FROM mutations WHERE user_id=? AND key=?", [
          user.id,
          key,
        ])
      )
        return { ok: true, replayed: true };
      await db.query("INSERT INTO mutations(user_id,key) VALUES(?,?)", [
        user.id,
        key,
      ]);
      return { ok: true, ...(await mutate(db, user, action, data)) };
    });
    const { status = 200, ...body } = result;
    return new Response(JSON.stringify(body), { status, headers });
  } catch (error) {
    const conflict =
      error.code === "23505" || error.code === "SQLITE_CONSTRAINT_UNIQUE";
    const status =
      error instanceof ApiError ? error.status : conflict ? 409 : 500;
    const message =
      error instanceof ApiError
        ? error.message
        : conflict
          ? "El registro ya existe. Actualiza e intenta nuevamente."
          : "No se pudo completar la solicitud.";
    if (status === 500)
      console.error("API failure:", error.name, error.code || "internal");
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers,
    });
  }
}
