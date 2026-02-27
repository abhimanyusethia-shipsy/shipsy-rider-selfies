import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromHeader } from "@/lib/auth";
import { getAbsoluteImagePath } from "@/lib/upload";
import fs from "fs";
import path from "path";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const user = getAuthUserFromHeader(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { path: pathSegments } = await params;
  const relativePath = pathSegments.join("/");

  // Path traversal protection
  if (relativePath.includes("..") || relativePath.startsWith("/")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const absolutePath = getAbsoluteImagePath(relativePath);
  const uploadsDir = path.join(process.cwd(), "data", "uploads");

  // Ensure resolved path is within uploads directory
  const resolvedPath = path.resolve(absolutePath);
  if (!resolvedPath.startsWith(path.resolve(uploadsDir))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  if (!fs.existsSync(absolutePath)) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(absolutePath);
  const ext = path.extname(absolutePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
