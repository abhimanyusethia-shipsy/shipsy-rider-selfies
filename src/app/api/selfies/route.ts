import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromHeader } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { saveUploadedFile, readImageAsBase64 } from "@/lib/upload";
import { validateSelfie } from "@/lib/gemini";

export async function GET(request: NextRequest) {
  const user = getAuthUserFromHeader(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const db = getDb();
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const status = url.searchParams.get("status"); // approved, rejected, or null for all
  const search = url.searchParams.get("search");
  const dateFrom = url.searchParams.get("dateFrom"); // YYYY-MM-DD
  const dateTo = url.searchParams.get("dateTo");     // YYYY-MM-DD
  const offset = (page - 1) * limit;

  let whereClause = "1=1";
  const params: (string | number)[] = [];

  if (status && status !== "all") {
    whereClause += " AND s.ai_status = ?";
    params.push(status);
  }

  if (search) {
    whereClause += " AND u.display_name LIKE ?";
    params.push(`%${search}%`);
  }

  if (dateFrom) {
    whereClause += " AND s.uploaded_at >= ?";
    params.push(`${dateFrom} 00:00:00`);
  }

  if (dateTo) {
    whereClause += " AND s.uploaded_at <= ?";
    params.push(`${dateTo} 23:59:59`);
  }

  const countRow = db
    .prepare(
      `SELECT COUNT(*) as count FROM selfies s JOIN users u ON s.user_id = u.id WHERE ${whereClause}`
    )
    .get(...params) as { count: number };

  const selfies = db
    .prepare(
      `SELECT s.id, s.image_path, s.ai_status, s.ai_reasoning, s.ai_face_valid, s.ai_real_person, s.ai_face_match, s.uploaded_at,
              u.display_name as worker_name, u.username,
              pp.image_path as profile_image_path
       FROM selfies s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN profile_pictures pp ON s.profile_picture_id = pp.id
       WHERE ${whereClause}
       ORDER BY s.uploaded_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as Array<{
    id: number;
    image_path: string;
    ai_status: string;
    ai_reasoning: string | null;
    ai_face_valid: number;
    ai_real_person: number;
    ai_face_match: number;
    uploaded_at: string;
    worker_name: string;
    username: string;
    profile_image_path: string | null;
  }>;

  return NextResponse.json({
    selfies: selfies.map((s) => ({
      id: s.id,
      selfieUrl: `/api/images/${s.image_path}`,
      profileUrl: s.profile_image_path
        ? `/api/images/${s.profile_image_path}`
        : null,
      aiStatus: s.ai_status,
      aiReasoning: s.ai_reasoning ? JSON.parse(s.ai_reasoning) : [],
      aiFaceValid: !!s.ai_face_valid,
      aiRealPerson: !!s.ai_real_person,
      aiFaceMatch: !!s.ai_face_match,
      uploadedAt: s.uploaded_at,
      workerName: s.worker_name,
      username: s.username,
    })),
    total: countRow.count,
    page,
    totalPages: Math.ceil(countRow.count / limit),
  });
}

export async function POST(request: NextRequest) {
  const user = getAuthUserFromHeader(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const db = getDb();

    // Check if profile picture exists
    const profile = db
      .prepare(
        "SELECT id, image_path FROM profile_pictures WHERE user_id = ? AND ai_valid = 1 ORDER BY uploaded_at DESC LIMIT 1"
      )
      .get(user.userId) as { id: number; image_path: string } | undefined;

    if (!profile) {
      return NextResponse.json(
        { error: "Please upload a valid profile picture first" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Save selfie to disk
    const selfiePath = await saveUploadedFile(file, "selfies");

    // Read images as base64
    const selfieData = readImageAsBase64(selfiePath);
    const profileData = readImageAsBase64(profile.image_path);

    // Validate with Gemini
    const aiResult = await validateSelfie(
      selfieData.base64,
      selfieData.mimeType,
      profileData.base64,
      profileData.mimeType
    );

    // Save to database
    db.prepare(
      `INSERT INTO selfies (user_id, image_path, profile_picture_id, ai_status, ai_reasoning, ai_face_valid, ai_real_person, ai_face_match)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      user.userId,
      selfiePath,
      profile.id,
      aiResult.overall_status,
      JSON.stringify(aiResult.reasoning),
      aiResult.face_valid ? 1 : 0,
      aiResult.real_person ? 1 : 0,
      aiResult.face_match ? 1 : 0
    );

    return NextResponse.json({
      success: true,
      selfieUrl: `/api/images/${selfiePath}`,
      aiStatus: aiResult.overall_status,
      aiFaceValid: aiResult.face_valid,
      aiRealPerson: aiResult.real_person,
      aiFaceMatch: aiResult.face_match,
      aiReasoning: aiResult.reasoning,
    });
  } catch (error) {
    console.error("Selfie upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
