import { NextResponse, type NextRequest } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";

import { createRateLimiter, type RateLimiter } from "@/lib/rate-limit";
import { isSameOriginRequest, readJsonBody } from "@/lib/request-guards";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/user";

/**
 * שמירת כרטיס דרך השרת: הדפדפן מדבר רק עם הדומיין שלנו, והשרת קורא ל-RPC
 * בסשן של המשתמש עצמו (לא service role). auth.uid() וכל כללי ההרשאה שבתוך
 * ה-RPC נשארים בדיוק כפי שהיו כשהקריאה יצאה מהדפדפן.
 */

/**
 * תקרת גוף הבקשה. כרטיס מלא שנמדד בפועל בבדיקות הוא כ-1.7KB; גם כרטיס עם
 * כל השדות הארוכים ביותר, הרבה ילדים והיסטוריה, נשאר הרבה מתחת ל-100KB.
 * 256KB נותנים מרווח גדול, ועדיין חוסמים גוף שלא יכול להיות כרטיס.
 */
export const MAX_PROFILE_BODY_BYTES = 256 * 1024;

const MINUTE_MS = 60_000;
const RATE_WINDOW_MS = 10 * MINUTE_MS;
const RETRY_AFTER_SECONDS = "60";

/** שמירה אחת בשלב הוא שימוש רגיל: אשף העריכה שומר בכל שלב */
export const createProfileLimiter = createRateLimiter({
  limit: 30,
  windowMs: RATE_WINDOW_MS,
});
export const updateProfileLimiter = createRateLimiter({
  limit: 120,
  windowMs: RATE_WINDOW_MS,
});

/** מבנה בלבד: חוקי השדות שייכים לטופס ול-RPC, ולא משוכפלים כאן */
const bodySchema = z.object({
  payload: z.record(z.string(), z.unknown()),
});

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

type RpcResult = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

type SaveRoute = {
  /** שם לשורות הלוג */
  label: string;
  limiter: RateLimiter;
  /** מבצע את ה-RPC; מקבל את ה-payload ומחזיר את התשובה הגולמית */
  call: (
    supabase: ServerSupabase,
    payload: Record<string, unknown>,
  ) => PromiseLike<RpcResult>;
  /** בונה את תשובת ההצלחה מתוצאת ה-RPC */
  onSuccess: (data: unknown) => NextResponse;
};

/** הודעות ה-RAISE EXCEPTION של ה-RPC, ולאיזה סטטוס כל אחת שייכת */
const RPC_MESSAGE_STATUS: Readonly<Record<string, number>> = {
  authentication_required: 401,
  not_allowed: 403,
  student_not_found: 404,
};

/** קודי SQLSTATE: 22 = ערך לא תקין, 23505 = כפילות, 23 = הפרת אילוץ, 42501 = הרשאה */
function statusForRpcError(error: { message: string; code?: string }): number {
  const byMessage = RPC_MESSAGE_STATUS[error.message];
  if (byMessage) return byMessage;
  const code = error.code ?? "";
  if (code === "42501") return 403;
  if (code === "23505") return 409;
  if (code.startsWith("22") || code.startsWith("23")) return 400;
  return 500;
}

function errorResponse(
  status: number,
  error: string,
  extra: { code?: string; headers?: HeadersInit } = {},
) {
  return NextResponse.json(
    { error, ...(extra.code ? { code: extra.code } : {}) },
    { status, headers: extra.headers },
  );
}

/** ה-RPC מתעלם מ-user_id שב-payload; מסירים אותו כדי שלא יגיע אליו כלל */
export function withoutClientUserId(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => key !== "user_id"),
  );
}

/** כל השלבים המשותפים: מקור, התחברות, קצב, גוף, קריאה ל-RPC, תשובת JSON */
export async function handleProfileSave(
  req: NextRequest,
  route: SaveRoute,
): Promise<NextResponse> {
  noStore();

  if (!isSameOriginRequest(req.headers)) {
    return errorResponse(403, "Forbidden");
  }

  const user = await getUser();
  if (!user) return errorResponse(401, "Unauthorized");

  if (!route.limiter.allow(user.id)) {
    return errorResponse(429, "יותר מדי ניסיונות שמירה. נסו שוב בעוד דקה.", {
      headers: { "Retry-After": RETRY_AFTER_SECONDS },
    });
  }

  const body = await readJsonBody(req, MAX_PROFILE_BODY_BYTES);
  if (!body.ok) return errorResponse(body.status, body.error);

  const parsed = bodySchema.safeParse(body.body);
  if (!parsed.success) return errorResponse(400, "Invalid body");

  try {
    const supabase = await createClient();
    const { data, error } = await route.call(supabase, parsed.data.payload);

    if (error) {
      console.error(`[${route.label}]`, error);
      return errorResponse(statusForRpcError(error), error.message, {
        code: error.code,
      });
    }
    return route.onSuccess(data);
  } catch (error) {
    console.error(`[${route.label}] unexpected`, error);
    return errorResponse(500, "שגיאה בשמירה");
  }
}
