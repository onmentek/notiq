import { jsonResponse, optionsResponse, verifyApiAuth } from "@/lib/auth";
import { getNoteById, softDeleteNote, updateNote } from "@/lib/db";
import type { Note } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authError = verifyApiAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const note = await getNoteById(id);
  if (!note) return jsonResponse({ error: "Not bulunamadı" }, 404);
  return jsonResponse({ note });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authError = verifyApiAuth(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const body = (await request.json()) as Partial<Note> & {
      prependText?: string;
      prependAsChecklist?: boolean;
      prependWithTimestamp?: boolean;
    };
    const updated = await updateNote(id, body);
    if (!updated) return jsonResponse({ error: "Not bulunamadı" }, 404);
    return jsonResponse({ note: updated });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Not güncellenemedi" },
      500
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authError = verifyApiAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const ok = await softDeleteNote(id);
  if (!ok) return jsonResponse({ error: "Not bulunamadı" }, 404);
  return jsonResponse({ ok: true, id });
}
