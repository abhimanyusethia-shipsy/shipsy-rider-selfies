import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromHeader } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { saveUploadedFile, readImageAsBase64 } from "@/lib/upload";
import { validateProfilePicture } from "@/lib/gemini";

export async function GET(request: NextRequest) {
  const user = getAuthUserFromHeader(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const db = getDb();
  const profile = db
    .prepare(
      "SELECT id, image_path, ai_valid, ai_reasoning, uploaded_at FROM profile_pictures WHERE user_id = ? ORDER BY uploaded_at DESC LIMIT 1"
    )
    .get(user.userId) as {
    id: number;
    image_path: string;
    ai_valid: number;
    ai_reasoning: string | null;
    uploaded_at: string;
  } | undefined;

  if (!profile) {
    return NextResponse.json({ exists: false });
  }

  return NextResponse.json({
    exists: true,
    id: profile.id,
    imagePath: profile.image_path,
    imageUrl: `/api/images/${profile.image_path}`,
    aiValid: !!profile.ai_valid,
    aiReasoning: profile.ai_reasoning ? JSON.parse(profile.ai_reasoning) : [],
    uploadedAt: profile.uploaded_at,
  });
}

export async function POST(request: NextRequest) {
  const user = getAuthUserFromHeader(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Save file to disk
    const relativePath = await saveUploadedFile(file, "profiles");

    // Read back as base64 for Gemini
    const { base64, mimeType } = readImageAsBase64(relativePath);

    // Validate with Gemini
    const aiResult = await validateProfilePicture(base64, mimeType);

    // Save to database
    const db = getDb();
    db.prepare(
      "INSERT INTO profile_pictures (user_id, image_path, ai_valid, ai_reasoning) VALUES (?, ?, ?, ?)"
    ).run(
      user.userId,
      relativePath,
      aiResult.valid ? 1 : 0,
      JSON.stringify(aiResult.reasoning)
    );

    return NextResponse.json({
      success: true,
      imageUrl: `/api/images/${relativePath}`,
      aiValid: aiResult.valid,
      faceDetected: aiResult.face_detected,
      realPerson: aiResult.real_person,
      aiReasoning: aiResult.reasoning,
    });
  } catch (error) {
    console.error("Profile picture upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
