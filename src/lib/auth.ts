import { NextResponse } from "next/server";

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function jsonResponse(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

export function optionsResponse(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Checks optional SYNC_SECRET bearer token.
 * If SYNC_SECRET is unset, runs in open single-user mode.
 */
export function verifyApiAuth(request: Request): NextResponse | null {
  const secret = process.env.SYNC_SECRET?.trim();
  if (!secret) return null;

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (token !== secret) {
    return jsonResponse(
      { error: "Yetkisiz erişim. Ayarlardan geçerli Sync Anahtarını girin." },
      401
    );
  }
  return null;
}
