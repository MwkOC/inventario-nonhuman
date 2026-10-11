import { parse } from "csv-parse/sync";
import yauzl from "yauzl";
import { ApiError, requireValue } from "./validation.mjs";

export async function parsePeople(db, rows, allowExisting = false) {
  requireValue(
    Array.isArray(rows) && rows.length <= 500,
    "Importa hasta 500 personas a la vez.",
  );
  const seenDni = new Set(),
    seenEmail = new Set(),
    result = [];
  for (const raw of rows) {
    requireValue(
      raw && typeof raw === "object" && !Array.isArray(raw),
      "Fila invalida.",
    );
    const row = Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [
        key.trim().toLowerCase(),
        value,
      ]),
    );
    const dni = String(row.dni ?? "").trim();
    const email = String(row.correo ?? row.email ?? "")
      .trim()
      .toLowerCase();
    const name = String(
      row.nombre || row.name || `${row.nombres || ""} ${row.apellidos || ""}`,
    )
      .trim()
      .replace(/\s+/g, " ");
    let role = String(row.rol || row.role || "member")
      .trim()
      .toLowerCase();
    role =
      { administrador: "admin", miembro: "member", externo: "external" }[
        role
      ] || role;
    let error = "";
    if (!/^\d{8}$/.test(dni)) error = "DNI: 8 digitos.";
    else if (!name || name.length > 100)
      error = "Nombre requerido (hasta 100 caracteres).";
    else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      error = "Correo invalido.";
    else if (!["admin", "member", "external"].includes(role))
      error = "Rol invalido.";
    else if (
      seenDni.has(dni) ||
      (!allowExisting &&
        (await db.one("SELECT id FROM users WHERE dni=?", [dni])))
    )
      error = "DNI duplicado.";
    else if (
      seenEmail.has(email) ||
      (!allowExisting &&
        (await db.one("SELECT id FROM users WHERE lower(email)=?", [email])))
    )
      error = "Correo duplicado.";
    seenDni.add(dni);
    seenEmail.add(email);
    result.push({ dni, email, name, role, error });
  }
  return result;
}

async function checkZip(buffer) {
  await new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zip) => {
      if (error) return reject(error);
      let total = 0,
        count = 0;
      zip.on("error", reject);
      zip.on("entry", (entry) => {
        total += entry.uncompressedSize;
        count++;
        if (total > 16 * 1024 * 1024 || count > 1000) {
          zip.close();
          reject(new ApiError("El Excel descomprimido es demasiado grande."));
          return;
        }
        zip.readEntry();
      });
      zip.on("end", resolve);
      zip.readEntry();
    });
  });
}
export async function readPeopleFile(buffer, filename) {
  requireValue(
    buffer.length <= 2 * 1024 * 1024,
    "Usa un archivo de hasta 2 MB.",
  );
  try {
    let rows;
    if (filename.toLowerCase().endsWith(".csv")) {
      rows = parse(buffer, {
        columns: true,
        bom: true,
        skip_empty_lines: true,
        to: 501,
        max_record_size: 10000,
      });
    } else {
      requireValue(filename.toLowerCase().endsWith(".xlsx"), "Usa XLSX o CSV.");
      await checkZip(buffer);
      const { readSheet } = await import("read-excel-file/node");
      const sheet = await readSheet(buffer);
      const [headers = [], ...values] = sheet;
      rows = values
        .filter((row) => row.some((v) => v != null))
        .map((row) =>
          Object.fromEntries(
            headers.map((key, i) => [String(key || ""), row[i]]),
          ),
        );
    }
    requireValue(
      rows.length > 0 && rows.length <= 500,
      "Importa entre 1 y 500 personas.",
    );
    return rows;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Archivo invalido. Usa XLSX o CSV.");
  }
}

export async function createPerson(db, row) {
  const user = await db.one(
    "INSERT INTO users(dni,name,email,role) VALUES(?,?,?,?) RETURNING *",
    [row.dni, row.name, row.email, row.role],
  );
  await queueMail(db, user.id);
  return user;
}
export async function queueMail(db, id) {
  await db.query("INSERT INTO mail_tasks(user_id,created) VALUES(?,?)", [
    id,
    new Date().toISOString(),
  ]);
}
