import {
  randomBytes,
  createHash,
  createHmac,
  timingSafeEqual,
  scrypt,
  pbkdf2,
} from "node:crypto";
import { promisify } from "node:util";
import { config } from "./config.mjs";

export const randomToken = () => randomBytes(32).toString("hex");
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export const equal = (a, b) =>
  typeof a === "string" &&
  typeof b === "string" &&
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
export const SESSION_AGE = 30 * 86400;
export const expiresIn = (seconds) =>
  new Date(Date.now() + seconds * 1000).toISOString();

export async function hashPassword(password) {
  const salt = randomToken();
  const hash = await promisify(scrypt)(password, salt, 32, {
    N: 131072,
    r: 8,
    p: 1,
    maxmem: 256 * 1024 * 1024,
  });
  return `scrypt$131072$${salt}$${hash.toString("base64")}`;
}
export async function verifyPassword(password, encoded) {
  if (
    typeof password !== "string" ||
    password.length > 128 ||
    typeof encoded !== "string"
  )
    return false;
  const [algorithm, cost, salt, expected] = encoded.split("$");
  if (!salt || !expected) return false;
  let hash;
  if (
    algorithm === "pbkdf2_sha256" &&
    Number(cost) >= 10000 &&
    Number(cost) <= 5000000
  ) {
    hash = await promisify(pbkdf2)(password, salt, Number(cost), 32, "sha256");
  } else if (algorithm === "scrypt" && ["32768", "131072"].includes(cost)) {
    hash = await promisify(scrypt)(password, salt, 32, {
      N: Number(cost),
      r: 8,
      p: 1,
      maxmem: 256 * 1024 * 1024,
    });
  } else return false;
  return equal(hash.toString("base64"), expected);
}

export function validPassword(password, user) {
  if (
    typeof password !== "string" ||
    password.length < 10 ||
    password.length > 128 ||
    !password.trim() ||
    /^\d+$/.test(password)
  )
    return false;
  const lower = password.toLowerCase();
  if (
    [
      "password123",
      "password1234",
      "qwerty12345",
      "1234567890",
      "nonhuman2026!",
    ].includes(lower)
  )
    return false;
  return ![user.dni, user.email.split("@")[0], ...user.name.split(" ")].some(
    (word) => word.length >= 4 && lower.includes(word.toLowerCase()),
  );
}

export function csrfToken() {
  const nonce = randomToken();
  return `${nonce}.${createHmac("sha256", config().secret).update(nonce).digest("hex")}`;
}
export function validCsrf(token) {
  if (typeof token !== "string") return false;
  const [nonce, signature, extra] = token.split(".");
  return (
    !extra &&
    /^[a-f0-9]{64}$/.test(nonce) &&
    equal(
      signature,
      createHmac("sha256", config().secret).update(nonce).digest("hex"),
    )
  );
}

export async function currentUser(db, token) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return (
    (await db.one(
      "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>? AND u.active=1",
      [digest(token), new Date().toISOString()],
    )) || null
  );
}

export async function rateLimit(db, key, maximum, seconds) {
  const now = new Date().toISOString();
  await db.query("DELETE FROM rate_limits WHERE expires<=?", [now]);
  const row = await db.one("SELECT * FROM rate_limits WHERE key=?", [key]);
  if (row && row.attempts >= maximum) return false;
  await db.query(
    "INSERT INTO rate_limits(key,attempts,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=rate_limits.attempts+1",
    [key, expiresIn(seconds)],
  );
  return true;
}
