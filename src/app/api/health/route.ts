import { jsonResponse, optionsResponse } from "@/lib/auth";
import { ensureDbSchema, isRemoteTurso } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  try {
    const db = await ensureDbSchema();
    await db.execute("SELECT 1");
    return jsonResponse({
      ok: true,
      database: isRemoteTurso() ? "turso" : "local-libsql",
      timestamp: Date.now(),
    });
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Database error",
      },
      500
    );
  }
}
