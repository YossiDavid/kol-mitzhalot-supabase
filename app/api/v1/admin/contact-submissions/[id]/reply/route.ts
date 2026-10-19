import { NextResponse, type NextRequest } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";

import { getContactEmail } from "@/features/contact-email/lib/get-contact-email";
import {
  replyBodySchema,
  type ReplyRouteResponse,
  type Submission,
  type SubmissionReply,
} from "@/features/contact-submissions/lib/submission-model";
import { sendEmail } from "@/lib/email/send-email";
import { buildSubmissionReplyEmail } from "@/lib/email/templates/contact-submission-reply";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user";

/** תקרת תשובות לפנייה אחת ביממה - מגן מפני לחיצות כפולות ולולאות */
const REPLIES_PER_SUBMISSION_PER_DAY = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
const TAG = "[contact-submission-reply]";

const ERROR = {
  invalid: "התשובה אינה תקינה (ריקה או ארוכה מדי)",
  notFound: "הפנייה לא נמצאה",
  rateLimited: "נשלחו יותר מדי תשובות לפנייה זו היום",
  failed: "שמירת התשובה נכשלה, נסו שוב",
} as const;

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

type AuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

/** שם המנהל לתצוגה בהיסטוריה: שם פרטי ומשפחה, ואם אין - האימייל */
function authorName(user: AuthUser): string | null {
  const meta = user.user_metadata ?? {};
  const name = [meta.firstName, meta.lastName]
    .filter((part): part is string => typeof part === "string" && !!part.trim())
    .join(" ");
  return name || user.email || null;
}

async function parseBody(req: NextRequest): Promise<string | null> {
  try {
    const parsed = replyBodySchema.safeParse(await req.json());
    return parsed.success ? parsed.data.body : null;
  } catch {
    return null;
  }
}

/**
 * POST: מנהל עונה לפנייה מהאתר. התשובה נשמרת קודם (כדי שלא ייצא מייל בלי
 * תיעוד), ואז נשלחת במייל לפונה. reply_to = אימייל יצירת הקשר של המערכת,
 * ואם לא הוגדר - האימייל של המנהל העונה. sendEmail לא זורק; התוצאה מוחזרת
 * למנהל (נשלח / נשמר בלבד בפיתוח / כשל מסירה).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  noStore();
  const { id } = await params;
  if (!z.guid().safeParse(id).success) return fail(ERROR.notFound, 404);

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return fail("Unauthorized", 401);
    if (!hasRole(user, "admin")) return fail("Forbidden", 403);

    const body = await parseBody(req);
    if (!body) return fail(ERROR.invalid, 400);

    const { data: submission, error: lookupError } = await supabase
      .from("contact_submissions")
      .select("id, name, email, subject, message")
      .eq("id", id)
      .maybeSingle<
        Pick<Submission, "id" | "name" | "email" | "subject" | "message">
      >();
    if (lookupError) {
      console.error(`${TAG}: טעינת הפנייה נכשלה`, lookupError);
      return fail(ERROR.failed, 500);
    }
    if (!submission) return fail(ERROR.notFound, 404);

    const since = new Date(Date.now() - DAY_MS).toISOString();
    const { count, error: countError } = await supabase
      .from("contact_submission_replies")
      .select("id", { count: "exact", head: true })
      .eq("submission_id", id)
      .gte("created_at", since);
    if (countError) {
      console.error(`${TAG}: בדיקת תקרה נכשלה`, countError);
      return fail(ERROR.failed, 500);
    }
    if ((count ?? 0) >= REPLIES_PER_SUBMISSION_PER_DAY) {
      return fail(ERROR.rateLimited, 429);
    }

    const { data: saved, error: insertError } = await supabase
      .from("contact_submission_replies")
      .insert({
        submission_id: id,
        author_id: user.id,
        author_name: authorName(user),
        body,
        sent_to: submission.email,
        email_sent: false,
      })
      .select("*")
      .single<SubmissionReply>();
    if (insertError || !saved) {
      console.error(`${TAG}: שמירת התשובה נכשלה`, insertError);
      return fail(ERROR.failed, 500);
    }

    const content = buildSubmissionReplyEmail({
      name: submission.name,
      subject: submission.subject,
      originalMessage: submission.message,
      reply: body,
    });
    const replyTo = (await getContactEmail()) ?? user.email ?? null;
    const result = await sendEmail({
      to: submission.email,
      subject: content.subject,
      text: content.text,
      html: content.html,
      replyTo,
    });
    const emailSent = result.ok && !result.skipped;
    if (!result.ok) console.error(`${TAG}: שליחת המייל נכשלה`, result.error);

    const reply = await finalizeReply(saved, emailSent, result.ok);
    const response: ReplyRouteResponse = {
      reply,
      emailSent,
      skipped: result.ok && result.skipped,
      emailError: result.ok ? null : "המייל לא נשלח לפונה",
    };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error(`${TAG}: שגיאה לא צפויה`, error);
    return fail(ERROR.failed, 500);
  }
}

/**
 * אחרי השליחה: סימון email_sent (אין מדיניות UPDATE למנהלים - עובר ב-service
 * role) ומעבר הפנייה ל"נענה" כשהשליחה הצליחה או דולגה בפיתוח. כשל כאן לא
 * מכשיל את התגובה: המייל כבר יצא והתשובה כבר נשמרה.
 */
async function finalizeReply(
  saved: SubmissionReply,
  emailSent: boolean,
  shouldMarkReplied: boolean,
): Promise<SubmissionReply> {
  const admin = createAdminClient();
  if (emailSent) {
    const { error } = await admin
      .from("contact_submission_replies")
      .update({ email_sent: true })
      .eq("id", saved.id);
    if (error) console.error(`${TAG}: סימון השליחה נכשל`, error);
  }
  if (shouldMarkReplied) {
    const { error } = await admin
      .from("contact_submissions")
      .update({ status: "replied" })
      .eq("id", saved.submission_id);
    if (error) console.error(`${TAG}: עדכון הסטטוס נכשל`, error);
  }
  return { ...saved, email_sent: emailSent };
}
