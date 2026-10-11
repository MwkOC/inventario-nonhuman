import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { transaction } from "./db.mjs";
import { config } from "./config.mjs";
import { randomToken, digest, expiresIn } from "./auth.mjs";

export async function dispatchMail(limit = 5) {
  const c = config();
  const tasks = await transaction((db) =>
    db.query(
      "SELECT id FROM mail_tasks WHERE sent IS NULL AND (lease IS NULL OR lease<?) ORDER BY id LIMIT ?",
      [new Date().toISOString(), limit],
    ),
  );
  for (const task of tasks) {
    const claim = await transaction(async (db) => {
      const row = await db.one(
        "SELECT m.*,u.email,u.active FROM mail_tasks m JOIN users u ON u.id=m.user_id WHERE m.id=? AND m.sent IS NULL AND (m.lease IS NULL OR m.lease<?)",
        [task.id, new Date().toISOString()],
      );
      if (!row) return null;
      if (
        await db.one(
          "SELECT id FROM mail_tasks WHERE user_id=? AND id<>? AND lease>?",
          [row.user_id, row.id, new Date().toISOString()],
        )
      )
        return null;
      if (!row.active) {
        await db.query("UPDATE mail_tasks SET sent=? WHERE id=?", [
          new Date().toISOString(),
          row.id,
        ]);
        return null;
      }
      const token = randomToken(),
        lease = expiresIn(120),
        expires = expiresIn(3600);
      await db.query(
        "UPDATE mail_tasks SET attempts=attempts+1,lease=? WHERE id=?",
        [lease, row.id],
      );
      await db.query(
        "INSERT INTO access_tokens(token,user_id,expires) VALUES(?,?,?)",
        [digest(token), row.user_id, expires],
      );
      return { ...row, token, lease, expires };
    });
    if (!claim) continue;
    try {
      const uid = Buffer.from(String(claim.user_id)).toString("base64url");
      const link = `${c.origin}/?uid=${uid}&token=${claim.token}`;
      const message = {
        from: process.env.DEFAULT_FROM_EMAIL,
        to: [claim.email],
        subject: "Tu acceso a NonHuman",
        text: `Crea o restablece tu contrasena:\n${link}\n\nTu usuario es tu DNI. El enlace vence en una hora y se usa una sola vez. Si no solicitaste este correo, ignoralo.`,
      };
      if (c.production) {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(message),
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error("Email delivery failed");
      } else {
        const directory = process.env.LOCAL_EMAIL_DIR || "local-emails";
        await mkdir(directory, { recursive: true, mode: 0o700 });
        await writeFile(
          path.join(directory, `next-${claim.id}-${Date.now()}.log`),
          message.text,
          { mode: 0o600 },
        );
      }
      await transaction(async (db) => {
        await db.query(
          "UPDATE mail_tasks SET sent=?,lease=NULL WHERE id=? AND lease=?",
          [new Date().toISOString(), claim.id, claim.lease],
        );
        // Keep previously delivered links usable until a replacement is delivered.
        await db.query(
          "DELETE FROM access_tokens WHERE user_id=? AND token<>? AND expires<=?",
          [claim.user_id, digest(claim.token), claim.expires],
        );
      });
    } catch {
      await transaction((db) =>
        db.query("UPDATE mail_tasks SET lease=NULL WHERE id=? AND lease=?", [
          claim.id,
          claim.lease,
        ]),
      );
    }
  }
}
