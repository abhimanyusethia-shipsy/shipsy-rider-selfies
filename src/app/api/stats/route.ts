import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromHeader } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  const user = getAuthUserFromHeader(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const db = getDb();

  const row = db
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN ai_status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN ai_status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        COUNT(DISTINCT user_id) as uniqueUsers
       FROM selfies`
    )
    .get() as {
    total: number;
    approved: number;
    rejected: number;
    uniqueUsers: number;
  };

  const total = row.total ?? 0;
  const approved = row.approved ?? 0;
  const rejected = row.rejected ?? 0;

  return NextResponse.json({
    total,
    approved,
    rejected,
    uniqueUsers: row.uniqueUsers ?? 0,
    approvedPct: total > 0 ? Math.round((approved / total) * 100) : 0,
    rejectedPct: total > 0 ? Math.round((rejected / total) * 100) : 0,
  });
}
