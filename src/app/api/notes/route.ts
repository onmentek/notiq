import { jsonResponse, optionsResponse, verifyApiAuth } from "@/lib/auth";
import { createNote, listNotes } from "@/lib/db";
import type { Note } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request) {
  const authError = verifyApiAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? undefined;
    const includeArchived = searchParams.get("archived") === "1";
    const includeDeleted = searchParams.get("deleted") === "1";
    const since = Number(searchParams.get("since") || "0") || 0;

    const notes = await listNotes({
      query,
      includeArchived,
      includeDeleted,
      since,
    });
    return jsonResponse({ notes, serverTime: Date.now() });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Notlar alınamadı" },
      500
    );
  }
}

export async function POST(request: Request) {
  const authError = verifyApiAuth(request);
  if (authError) return authError;

  try {
    const body = (await request.json()) as Partial<Note>;
    const note = await createNote(body);
    return jsonResponse({ note }, 201);
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Not oluşturulamadı" },
      500
    );
  }
}
