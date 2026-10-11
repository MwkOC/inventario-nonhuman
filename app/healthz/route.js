import { transaction } from "../../lib/db.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const version = await transaction((db) =>
      db.one("SELECT version FROM schema_versions WHERE version=1"),
    );
    if (!version) throw new Error("Schema not initialized");
    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
