import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { readImageAsBase64 } from "@/lib/upload";
import { validateSelfie } from "@/lib/gemini";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");

// MIME type → file extension mapping
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export async function POST(request: NextRequest) {
  // ── 1. Authenticate via API key ──────────────────────────────────────────
  const apiKey = request.headers.get("x-api-key");
  const expectedKey = process.env.WEBHOOK_SECRET;

  if (!expectedKey) {
    return NextResponse.json(
      { error: "Webhook not configured — WEBHOOK_SECRET env var is missing" },
      { status: 500 }
    );
  }

  if (!apiKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Parse and validate request body ───────────────────────────────────
  let body: { username?: string; selfieUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { username, selfieUrl } = body;

  if (!username || typeof username !== "string") {
    return NextResponse.json(
      { error: "Missing required field: username" },
      { status: 400 }
    );
  }

  if (!selfieUrl || typeof selfieUrl !== "string") {
    return NextResponse.json(
      { error: "Missing required field: selfieUrl" },
      { status: 400 }
    );
  }

  try {
    new URL(selfieUrl);
  } catch {
    return NextResponse.json(
      { error: "selfieUrl is not a valid URL" },
      { status: 400 }
    );
  }

  const db = getDb();

  // ── 3. Look up rider by username ─────────────────────────────────────────
  const rider = db
    .prepare("SELECT id, display_name FROM users WHERE username = ?")
    .get(username) as { id: number; display_name: string } | undefined;

  if (!rider) {
    return NextResponse.json(
      { error: `No user found with username: ${username}` },
      { status: 404 }
    );
  }

  // ── 4. Get rider's latest valid profile picture ───────────────────────────
  const profile = db
    .prepare(
      "SELECT id, image_path FROM profile_pictures WHERE user_id = ? AND ai_valid = 1 ORDER BY uploaded_at DESC LIMIT 1"
    )
    .get(rider.id) as { id: number; image_path: string } | undefined;

  if (!profile) {
    return NextResponse.json(
      {
        error: `Rider ${username} has no valid profile picture. Please upload one via the app first.`,
      },
      { status: 400 }
    );
  }

  // ── 5. Fetch selfie image from S3 ─────────────────────────────────────────
  let imageBuffer: Buffer;
  let mimeType: string;

  try {
    const s3Response = await fetch(selfieUrl);

    if (!s3Response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image from S3: HTTP ${s3Response.status}` },
        { status: 400 }
      );
    }

    const contentType = s3Response.headers.get("content-type") || "image/jpeg";
    mimeType = contentType.split(";")[0].trim();
    imageBuffer = Buffer.from(await s3Response.arrayBuffer());
  } catch (err) {
    console.error("S3 fetch error:", err);
    return NextResponse.json(
      { error: "Could not download image from the provided URL" },
      { status: 400 }
    );
  }

  // ── 6. Save selfie to disk ────────────────────────────────────────────────
  const ext = MIME_TO_EXT[mimeType] ?? ".jpg";
  const filename = `${uuidv4()}${ext}`;
  const relativePath = `selfies/${filename}`;
  const absolutePath = path.join(UPLOADS_DIR, relativePath);

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, imageBuffer);

  // ── 7. Prepare base64 for Gemini ─────────────────────────────────────────
  const selfieBase64 = imageBuffer.toString("base64");
  const profileData = readImageAsBase64(profile.image_path);

  // ── 8. Run Gemini AI validation ───────────────────────────────────────────
  const aiResult = await validateSelfie(
    selfieBase64,
    mimeType,
    profileData.base64,
    profileData.mimeType
  );

  // ── 9. Persist to database ────────────────────────────────────────────────
  const insertResult = db
    .prepare(
      `INSERT INTO selfies (user_id, image_path, profile_picture_id, ai_status, ai_reasoning, ai_face_valid, ai_real_person, ai_face_match)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      rider.id,
      relativePath,
      profile.id,
      aiResult.overall_status,
      JSON.stringify(aiResult.reasoning),
      aiResult.face_valid ? 1 : 0,
      aiResult.real_person ? 1 : 0,
      aiResult.face_match ? 1 : 0
    );

  // ── 10. Return result ─────────────────────────────────────────────────────
  return NextResponse.json({
    selfieId: insertResult.lastInsertRowid,
    rider: rider.display_name,
    username,
    aiStatus: aiResult.overall_status,
    aiFaceValid: aiResult.face_valid,
    aiRealPerson: aiResult.real_person,
    aiFaceMatch: aiResult.face_match,
    aiReasoning: aiResult.reasoning,
  });
}
