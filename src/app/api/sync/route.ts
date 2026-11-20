import { jsonResponse, optionsResponse, verifyApiAuth } from "@/lib/auth";
import { syncNotesBatch } from "@/lib/db";
import type { Note } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: Request) {
  const authError = verifyApiAuth(request);
  if (authError) return authError;

  try {
    const body = (await request.json()) as {
      notes?: Note[];
      since?: number;
    };
    const incoming = Array.isArray(body.notes) ? body.notes : [];
    const since = Number(body.since || 0) || 0;

    const result = await syncNotesBatch(incoming, since);
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Senkronizasyon hatası" },
      500
    );
  }
}
