import { config } from "./config.mjs";
import {
  requireValue as require,
  text,
  number,
  person,
  record,
  event,
  ApiError,
} from "./validation.mjs";
import { parsePeople, createPerson, queueMail } from "./people.mjs";

export async function snapshot(db, user) {
  const admin = user.role === "admin";
  const attendance = await db.query(
    `SELECT a.*,u.name,u.role FROM attendance a JOIN users u ON u.id=a.user_id ${admin ? "" : "WHERE a.user_id=?"} ORDER BY entered DESC`,
    admin ? [] : [user.id],
  );
  const result = {
    user: person(user),
    demo: config().demo,
    attendance,
    inside: attendance.some((a) => a.user_id === user.id && !a.exited),
  };
  if (user.role !== "external") {
    result.items = (
      await db.query("SELECT * FROM items WHERE active=1 ORDER BY name")
    ).map((i) => ({
      ...i,
      active: Boolean(i.active),
      consumable: Boolean(i.consumable),
    }));
    result.loans = (
      await db.query(
        `SELECT l.*,u.name,i.name AS item,i.consumable FROM loans l JOIN users u ON u.id=l.user_id JOIN items i ON i.id=l.item_id ${admin ? "" : "WHERE l.user_id=?"} ORDER BY created DESC`,
        admin ? [] : [user.id],
      )
    ).map((l) => ({ ...l, consumable: Boolean(l.consumable) }));
    result.visits = await db.query(
      `SELECT v.*,u.name AS host FROM visits v JOIN users u ON u.id=v.host_id ${admin ? "" : "WHERE v.host_id=?"} ORDER BY entered DESC`,
      admin ? [] : [user.id],
    );
  }
  if (admin) {
    result.people = (await db.query("SELECT * FROM users ORDER BY name")).map(
      person,
    );
    result.events = await db.query(
      "SELECT e.*,u.name FROM events e JOIN users u ON u.id=e.actor_id ORDER BY created DESC,id DESC LIMIT 100",
    );
    result.notifications = (
      await db.query(
        "SELECT n.id,n.read,e.text,e.created,u.name FROM notifications n JOIN events e ON e.id=n.event_id JOIN users u ON u.id=e.actor_id WHERE n.recipient_id=? ORDER BY n.id DESC LIMIT 100",
        [user.id],
      )
    ).map((n) => ({ ...n, read: Boolean(n.read) }));
    result.mail_pending = Number(
      (
        await db.one(
          "SELECT count(*) AS count FROM mail_tasks WHERE sent IS NULL",
        )
      ).count,
    );
  }
  return result;
}

export async function mutate(db, user, action, data) {
  const now = new Date().toISOString();
  if (action === "check-in") {
    require(!(await db.one(
      "SELECT id FROM attendance WHERE user_id=? AND exited IS NULL",
      [user.id],
    )), "Ya registraste tu entrada.");
    await db.query("INSERT INTO attendance(user_id,entered) VALUES(?,?)", [
      user.id,
      now,
    ]);
    await event(db, user, "Registro de entrada", "attendance");
    return {};
  }
  if (action === "check-out") {
    const updated = await db.query(
      "UPDATE attendance SET exited=? WHERE user_id=? AND exited IS NULL RETURNING id",
      [now, user.id],
    );
    require(updated.length === 1, "No tienes una entrada abierta.");
    await event(db, user, "Registro de salida", "attendance");
    return {
      open_visits: Number(
        (
          await db.one(
            "SELECT count(*) AS count FROM visits WHERE host_id=? AND exited IS NULL",
            [user.id],
          )
        ).count,
      ),
    };
  }
  require(user.role !==
    "external", "Tu cuenta solo permite asistencia e historial.", 403);
  if (action === "visit-create") {
    const name = text(data, "name", 100),
      reason = text(data, "reason");
    await db.query(
      "INSERT INTO visits(host_id,name,reason,entered) VALUES(?,?,?,?)",
      [user.id, name, reason, now],
    );
    await event(db, user, `Ingreso de visitante: ${name}`, "visit");
    return {};
  }
  if (action === "visit-close") {
    const visit = await record(db, "visits", number(data, "id"));
    require(visit.host_id === user.id ||
      user.role === "admin", "No autorizado.", 403);
    require(!visit.exited, "La visita ya finalizo.");
    await db.query("UPDATE visits SET exited=? WHERE id=?", [now, visit.id]);
    await event(db, user, `Salida de visitante: ${visit.name}`, "visit");
    return {};
  }
  if (action === "checkout") {
    const reason = text(data, "reason"),
      lines = data.items;
    require(Array.isArray(lines) &&
      lines.length > 0 &&
      lines.length <= 50 &&
      lines.every(
        (l) => l && typeof l === "object" && !Array.isArray(l),
      ), "Selecciona articulos validos.");
    const ids = lines.map((line) => number(line, "id"));
    require(new Set(ids).size === ids.length, "Articulos duplicados.");
    const rawDue = typeof data.due === "string" ? data.due : "";
    const due = new Date(
      /^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d)?$/.test(rawDue)
        ? `${rawDue}-05:00`
        : rawDue,
    );
    const descriptions = [];
    for (const line of lines) {
      const item = await record(db, "items", number(line, "id")),
        quantity = number(line, "quantity");
      require(item.active, "Articulo no disponible.");
      require(item.available >= quantity, `Stock insuficiente: ${item.name}.`);
      require(item.consumable ||
        (!Number.isNaN(due.getTime()) &&
          due > new Date()), "Indica una devolucion futura.");
      await db.query(
        "UPDATE items SET available=available-?,total=total-? WHERE id=?",
        [quantity, item.consumable ? quantity : 0, item.id],
      );
      await db.query(
        "INSERT INTO loans(user_id,item_id,quantity,reason,due,created) VALUES(?,?,?,?,?,?)",
        [
          user.id,
          item.id,
          quantity,
          reason,
          item.consumable ? null : due.toISOString(),
          now,
        ],
      );
      descriptions.push(`${quantity} x ${item.name}`);
    }
    const e = await event(
      db,
      user,
      `Retiro: ${descriptions.join(", ")}`,
      "checkout",
    );
    await db.query(
      "INSERT INTO notifications(event_id,recipient_id) SELECT ?,id FROM users WHERE role='admin' AND active=1",
      [e.id],
    );
    return {};
  }
  if (action === "return") {
    const loan = await record(db, "loans", number(data, "id"));
    require(loan.user_id ===
      user.id, "Solo puedes devolver tus propios prestamos.", 403);
    const item = await record(db, "items", loan.item_id);
    require(!item.consumable, "Un consumo no es un prestamo.");
    const quantity = number(data, "quantity");
    require(quantity <=
      loan.quantity - loan.returned, "Cantidad superior a lo pendiente.");
    await db.query("UPDATE loans SET returned=returned+? WHERE id=?", [
      quantity,
      loan.id,
    ]);
    const field = data.damaged === true ? "unavailable" : "available";
    await db.query(`UPDATE items SET ${field}=${field}+? WHERE id=?`, [
      quantity,
      item.id,
    ]);
    await event(
      db,
      user,
      `Devolucion: ${quantity} x ${item.name}${data.damaged === true ? " (averiado)" : ""}`,
      "return",
    );
    return {};
  }
  require(user.role === "admin", "Solo administradores.", 403);
  if (action === "notifications-read") {
    await db.query("UPDATE notifications SET read=1 WHERE recipient_id=?", [
      user.id,
    ]);
  } else if (action === "person-create" || action === "import-people") {
    const rows = await parsePeople(
      db,
      action === "import-people" ? data.rows : [data],
    );
    require(rows.length &&
      rows.every((row) => !row.error), "Hay filas invalidas o duplicadas.");
    for (const row of rows) {
      const created = await createPerson(db, row);
      await event(db, user, `Alta de cuenta: ${created.name}`, "people");
    }
  } else if (action === "person-toggle") {
    const target = await record(db, "users", number(data, "id"));
    require(target.id !== user.id, "No puedes desactivar tu propia cuenta.");
    const admins = await db.query(
      "SELECT id FROM users WHERE role='admin' AND active=1",
    );
    require(!(
      target.role === "admin" &&
      target.active &&
      admins.length <= 1
    ), "Debe existir un administrador activo.");
    await db.query("UPDATE users SET active=?,password='!' WHERE id=?", [
      target.active ? 0 : 1,
      target.id,
    ]);
    await db.query("DELETE FROM sessions WHERE user_id=?", [target.id]);
    await db.query("DELETE FROM access_tokens WHERE user_id=?", [target.id]);
    if (!target.active) await queueMail(db, target.id);
    await event(
      db,
      user,
      `${target.active ? "Baja" : "Activacion"}: ${target.name}`,
      "people",
    );
  } else if (action === "invite") {
    const target = await record(db, "users", number(data, "id"));
    require(target.active, "Cuenta desactivada.");
    require(!(await db.one(
      "SELECT id FROM mail_tasks WHERE user_id=? AND created>?",
      [target.id, new Date(Date.now() - 120000).toISOString()],
    )), "Espera dos minutos antes de reenviar.");
    await queueMail(db, target.id);
  } else if (action === "item-create") {
    const image = typeof data.image === "string" ? data.image : "";
    require(!image ||
      /^\/assets\/[a-zA-Z0-9_./-]+$/.test(image) ||
      /^https:\/\//.test(image), "Imagen: usa una URL HTTPS.");
    require(image.length <= 500, "URL demasiado larga.");
    const quantity = number(data, "quantity", 0);
    await db.query(
      "INSERT INTO items(code,name,category,location,total,available,consumable,minimum,image) VALUES(?,?,?,?,?,?,?,?,?)",
      [
        text(data, "code", 30),
        text(data, "name", 120),
        text(data, "category", 50),
        text(data, "location", 100),
        quantity,
        quantity,
        data.consumable === true ? 1 : 0,
        number(data, "minimum", 0),
        image,
      ],
    );
    await event(db, user, `Alta de articulo: ${data.name}`, "stock");
  } else if (action === "stock") {
    const item = await record(db, "items", number(data, "id")),
      quantity = number(data, "quantity"),
      reason = text(data, "reason");
    const operation = data.operation || "add";
    require(["add", "remove", "repair"].includes(
      operation,
    ), "Operacion invalida.");
    if (operation === "add") {
      require(item.total + quantity <= 1000000, "Stock fuera de rango.");
      await db.query(
        "UPDATE items SET total=total+?,available=available+? WHERE id=?",
        [quantity, quantity, item.id],
      );
    } else if (operation === "remove") {
      require(item.available >=
        quantity, "Solo se puede dar de baja stock disponible.");
      await db.query(
        "UPDATE items SET total=total-?,available=available-? WHERE id=?",
        [quantity, quantity, item.id],
      );
    } else {
      require(item.unavailable >=
        quantity, "No hay suficientes unidades averiadas.");
      await db.query(
        "UPDATE items SET unavailable=unavailable-?,available=available+? WHERE id=?",
        [quantity, quantity, item.id],
      );
    }
    await event(
      db,
      user,
      `${operation}: ${quantity} x ${item.name}. ${reason}`,
      "stock",
    );
  } else throw new ApiError("Accion no encontrada.", 404);
  return {};
}
