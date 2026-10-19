/**
 * Callers: components/website/donations/donation-form.tsx (לפני StartPayment).
 * יוצר כוונת תרומה (pending) ומחזיר את ה-id שישמש כ-Param2 ואת כתובת ה-CallBack.
 * ציבורי; ה-id וכתובת ה-CallBack נקבעים בשרת בלבד, לעולם לא מהלקוח.
 * רכישת פרנס (dedicationKind): הסכום חייב להיות המחיר העדכני, והמשבצת פנויה
 * לתקופה שנקבעת כאן (היום בישראל); אחרת 400 / 409 בלי ליצור שורה.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getAppOrigin } from "@/lib/app-url";
import { getClientIp } from "@/lib/client-ip";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import { israelDateOf } from "@/features/dedications/lib/israel-date";
import { buildCallbackUrl } from "@/features/donations/lib/callback-url";
import { checkDedicationPurchase } from "@/features/donations/lib/dedication-purchase";
import {
  type DedicationPeriod,
  toDonationInsert,
  validateDonationIntent,
} from "@/features/donations/lib/intent";
import {
  RETRY_AFTER_SECONDS,
  intentLimiter,
} from "@/features/donations/lib/rate-limits";

const SERVER_ERROR_MESSAGE = "לא הצלחנו להתחיל את התרומה. נסו שוב בעוד רגע.";

export async function POST(request: NextRequest) {
  if (!intentLimiter.allow(getClientIp(request))) {
    return NextResponse.json(
      { error: "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות." },
      { status: 429, headers: { "Retry-After": RETRY_AFTER_SECONDS } },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  }

  const validation = validateDonationIntent(payload);
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.message, fields: validation.fields },
      { status: 400 },
    );
  }

  try {
    const db = createAdminClient();
    const { dedicationKind, amount } = validation.data;
    let period: DedicationPeriod | null = null;
    if (dedicationKind) {
      const purchase = await checkDedicationPurchase(
        db,
        dedicationKind,
        amount,
        israelDateOf(new Date()),
      );
      if (!purchase.ok) {
        return NextResponse.json(
          { error: purchase.message ?? SERVER_ERROR_MESSAGE },
          { status: purchase.status },
        );
      }
      period = purchase.period;
    }

    const { data, error } = await db
      .from("donations")
      .insert(toDonationInsert(validation.data, period))
      .select("id")
      .single();
    if (error) {
      console.error(
        "[donations/intent] insert failed",
        describeSupabaseError(error),
      );
      return NextResponse.json(
        { error: SERVER_ERROR_MESSAGE },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { id: data.id, callbackUrl: buildCallbackUrl(getAppOrigin()) },
      { status: 201 },
    );
  } catch (error) {
    console.error("[donations/intent] unexpected error", error);
    return NextResponse.json({ error: SERVER_ERROR_MESSAGE }, { status: 500 });
  }
}
