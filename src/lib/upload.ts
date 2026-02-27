import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");

export async function saveUploadedFile(
  file: File,
  subfolder: "profiles" | "selfies"
): Promise<string> {
  const ext = path.extname(file.name) || ".jpg";
  const filename = `${uuidv4()}${ext}`;
  const relativePath = `${subfolder}/${filename}`;
  const absolutePath = path.join(UPLOADS_DIR, relativePath);

  // Ensure directory exists
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(absolutePath, buffer);

  return relativePath;
}

export function getAbsoluteImagePath(relativePath: string): string {
  return path.join(UPLOADS_DIR, relativePath);
}

export function readImageAsBase64(relativePath: string): {
  base64: string;
  mimeType: string;
} {
  const absolutePath = getAbsoluteImagePath(relativePath);
  const buffer = fs.readFileSync(absolutePath);
  const ext = path.extname(relativePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  return {
    base64: buffer.toString("base64"),
    mimeType: mimeMap[ext] || "image/jpeg",
  };
}
