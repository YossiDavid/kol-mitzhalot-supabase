import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import {
  RESPONSE_MESSAGE_MAX_LENGTH,
  SHIDDUCH_RESPONSE_VALUES,
  SHIDDUCH_SIDES,
} from "@/features/shidduchim/lib/responses";
import { isShidduchStatus } from "@/features/shidduchim/lib/status";

/**
 * תגובת מנהל כרטיס (הורה) להצעת שידוך, בשם הצד שלו.
 *
 * אין כאן בדיקת hasRole בכוונה: ההרשאה היא בעלות על הכרטיס בצד הנתון, לא
 * תפקיד (הורה הוא ברירת המחדל "user", ושדכן יכול להיות גם הורה). הבדיקה
 * נעשית ב-public.respond_to_shidduch, שרצה עם הסשן של המשתמש (auth.uid()).
 */

const bodySchema = z.object({
  shidduchId: z.guid(),
  side: z.enum(SHIDDUCH_SIDES),
  response: z.enum(SHIDDUCH_RESPONSE_VALUES),
  message: z.string().max(RESPONSE_MESSAGE_MAX_LENGTH).optional().default(""),
});

const NOT_FOUND = { status: 404, error: "ההצעה לא נמצאה" } as const;

/** הודעות ה-RAISE של respond_to_shidduch → תשובה ידידותית */
const RPC_ERRORS: Record<string, { status: number; error: string }> = {
  authentication_required: { status: 401, error: "יש להתחבר מחדש" },
  // לא מבחינים בין "לא קיים" ל"לא שלך" כדי לא לחשוף קיום הצעה לזר
  shidduch_not_found: NOT_FOUND,
  not_side_owner: NOT_FOUND,
  side_not_recipient: NOT_FOUND,
  shidduch_closed: {
    status: 409,
    error: "ההצעה כבר נסגרה, ולא ניתן לעדכן את התגובה",
  },
  invalid_side: { status: 400, error: "צד לא תקין" },
  invalid_response: { status: 400, error: "תגובה לא תקינה" },
  message_too_long: { status: 400, error: "ההודעה ארוכה מדי" },
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { shidduchId, side, response, message } = parsed.data;

  const { data, error } = await supabase.rpc("respond_to_shidduch", {
    p_shidduch_id: shidduchId,
    p_side: side,
    p_response: response,
    p_message: message.trim() || null,
  });

  if (error) {
    const known = RPC_ERRORS[error.message];
    if (known) {
      return NextResponse.json(
        { error: known.error },
        { status: known.status },
      );
    }
    console.error("[shidduchim/respond] respond_to_shidduch failed", {
      shidduchId,
      side,
      error,
    });
    return NextResponse.json({ error: "שמירת התגובה נכשלה" }, { status: 500 });
  }

  const status =
    typeof data === "string" && isShidduchStatus(data) ? data : null;

  return NextResponse.json({ ok: true, status, response });
}
