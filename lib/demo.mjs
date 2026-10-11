import { config } from "./config.mjs";
import { transaction } from "./db.mjs";
import { hashPassword } from "./auth.mjs";
export async function seedDemo() {
  if (
    !config().demo ||
    !config().database.startsWith("sqlite:") ||
    config().database.includes("members")
  )
    throw new Error("Demo only allowed in a separate local SQLite database");
  const password = await hashPassword("NonHuman2026!");
  await transaction(async (db) => {
    if (await db.one("SELECT id FROM users LIMIT 1")) return;
    const names = [
      "Alex Rivera",
      "Lucia Torres",
      "Diego Vargas",
      "Valeria Ruiz",
      "Mateo Silva",
      "Camila Rojas",
      "Nicolas Leon",
      "Sofia Castro",
      "Gabriel Diaz",
      "Andrea Paz",
      "Sebastian Flores",
      "Daniela Vega",
      "Martin Luna",
      "Isabella Soto",
      "Adrian Cruz",
      "Elena Campos",
      "Bruno Salas",
      "Paula Mendez",
      "Joaquin Reyes",
      "Renata Molina",
      "Tomas Vidal",
    ];
    for (const [i, name] of names.entries())
      await db.query(
        "INSERT INTO users(dni,name,email,role,password) VALUES(?,?,?,?,?)",
        [
          String(10000001 + i),
          name,
          `demo${i + 1}@example.com`,
          i < 5 ? "admin" : i < 15 ? "member" : "external",
          password,
        ],
      );
    const items = [
      ["Arduino Uno R3", "Componentes", 12, 0, "arduino"],
      ["Camara Raspberry Pi", "Camaras", 5, 0, "camera"],
      ["Servomotor MG996R", "Actuadores", 18, 0, "servo"],
      ["Raspberry Pi 4", "Componentes", 8, 0, "pi"],
      ["Multimetro digital", "Herramientas", 6, 0, "meter"],
      ["Cables Dupont (pack)", "Consumibles", 32, 1, "wires"],
      ["Sensor ultrasonico HC-SR04", "Sensores", 15, 0, "sensor"],
      ["Kit de destornilladores", "Herramientas", 4, 0, "tools"],
      ["Resistencias 220 ohm", "Consumibles", 80, 1, "resistor"],
    ];
    for (const [
      i,
      [name, category, total, consumable, image],
    ] of items.entries())
      await db.query(
        "INSERT INTO items(code,name,category,location,total,available,consumable,minimum,image) VALUES(?,?,?,?,?,?,?,?,?)",
        [
          `NH-${String(i + 1).padStart(3, "0")}`,
          name,
          category,
          "A1 - Laboratorio",
          total,
          total,
          consumable,
          3,
          `/assets/${image}.jpg`,
        ],
      );
    for (let day = 0; day < 28; day++)
      for (let j = 0; j < 4 + ((day * 7) % 11); j++) {
        const entered = new Date(
          Date.now() - day * 86400000 - (j + 3) * 3600000,
        ).toISOString();
        await db.query(
          "INSERT INTO attendance(user_id,entered,exited) VALUES(?,?,?)",
          [
            ((j + day) % 21) + 1,
            entered,
            new Date(Date.parse(entered) + 3600000).toISOString(),
          ],
        );
      }
    for (let id = 2; id < 8; id++)
      await db.query("INSERT INTO attendance(user_id,entered) VALUES(?,?)", [
        id,
        new Date(Date.now() - id * 420000).toISOString(),
      ]);
    await db.query(
      "INSERT INTO visits(host_id,name,reason,entered) VALUES(1,?,?,?)",
      ["Mariana Lopez", "Reunion de proyecto", new Date().toISOString()],
    );
  });
}
