export class ApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function requireValue(condition, message, status = 400) {
  if (!condition) throw new ApiError(message, status);
}
export function text(data, key, length = 300) {
  const value = typeof data[key] === "string" ? data[key].trim() : "";
  requireValue(
    value.length > 0 && value.length <= length,
    `Revisa el campo ${key}.`,
  );
  return value;
}
export function number(data, key, minimum = 1) {
  const value = data[key];
  requireValue(
    (typeof value === "number" || typeof value === "string") &&
      /^\d+$/.test(String(value)),
    `Revisa la cantidad: ${key}.`,
  );
  const result = Number(value);
  requireValue(
    Number.isSafeInteger(result) && result >= minimum && result <= 1000000,
    `Cantidad fuera de rango: ${key}.`,
  );
  return result;
}
export function person(user) {
  return {
    id: user.id,
    name: user.name,
    dni: user.dni,
    email: user.email,
    role: user.role,
    active: Boolean(user.active),
  };
}
export async function record(db, table, id) {
  const row = await db.one(`SELECT * FROM ${table} WHERE id=?`, [id]);
  requireValue(row, "Registro no encontrado.", 404);
  return row;
}
export async function event(db, user, message, kind) {
  return db.one(
    "INSERT INTO events(actor_id,text,kind,created) VALUES(?,?,?,?) RETURNING id",
    [user.id, message.slice(0, 400), kind, new Date().toISOString()],
  );
}
