import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  CARD_REPORT_RESULTS,
  cardReportBodySchema,
} from "@/features/students/lib/card-report";
import { createClient } from "@/lib/supabase/server";

/**
 * דיווח על כרטיס. המדווח נלקח מהסשן (auth.uid() בתוך הפונקציה), והבדיקות -
 * שהצופה רואה את הכרטיס, שאינו בעליו, דיווח פתוח אחד, מכסה יומית והתראה לכל
 * המנהלים - נעשות ב-public.report_student_card ולא כאן.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  if (!z.guid().safeParse(studentId).success) {
    return NextResponse.json({ error: "הכרטיס לא נמצא" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "יש להתחבר מחדש" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }

  const parsed = cardReportBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message === "הפירוט ארוך מדי"
            ? "הפירוט ארוך מדי"
            : 'יש לבחור סיבה, ובסיבה "אחר" לפרט',
      },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.rpc("report_student_card", {
    p_student_id: studentId,
    p_reason: parsed.data.reason,
    p_details: parsed.data.details ?? "",
  });

  if (error) {
    console.error("[students/report] rpc failed", studentId, error);
    return NextResponse.json({ error: "שליחת הדיווח נכשלה" }, { status: 500 });
  }

  if (data === "created") {
    return NextResponse.json({ ok: true }, { status: 201 });
  }
  const known =
    typeof data === "string" ? CARD_REPORT_RESULTS[data] : undefined;
  if (known) {
    return NextResponse.json({ error: known.error }, { status: known.status });
  }
  console.error("[students/report] unexpected rpc result", studentId, data);
  return NextResponse.json({ error: "שליחת הדיווח נכשלה" }, { status: 500 });
}
