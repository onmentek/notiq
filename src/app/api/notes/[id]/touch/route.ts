import { jsonResponse, optionsResponse, verifyApiAuth } from "@/lib/auth";
import { touchNote } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authError = verifyApiAuth(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      openDelta?: number;
      focusMsDelta?: number;
    };
    const note = await touchNote(id, body);
    if (!note) return jsonResponse({ error: "Not bulunamadı" }, 404);
    return jsonResponse({ note });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Güncellenemedi" },
      500
    );
  }
}
