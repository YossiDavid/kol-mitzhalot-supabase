import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendShidduchOfferEmails } from "@/features/shidduchim/lib/send-offer-email";
import { hasRole } from "@/lib/user";

const recipientScopeSchema = z.enum(["both", "groom_only", "bride_only"]);

const bodySchema = z.object({
  // z.guid ולא z.uuid: החל מ-zod 4 המאמת של uuid בודק גם את ביטי הגרסה
  // לפי RFC 4122, ומזהים תקינים לחלוטין במסד (כולל נתוני הזרע) נפסלים.
  groomId: z.guid(),
  brideId: z.guid(),
  action: z.enum(["draft", "send"]),
  recipientScope: recipientScopeSchema.optional(),
  noteForGroom: z.string().max(8000).optional().default(""),
  noteForBride: z.string().max(8000).optional().default(""),
  // מה מנהלי הכרטיסים יראו בכרטיס של הצד השני. סגור כברירת מחדל, גם
  // כשהלקוח לא שלח כלום - הפתיחה היא בחירה אקטיבית של השדכן.
  shareContactDetails: z.boolean().optional().default(false),
  shareMedicalInfo: z.boolean().optional().default(false),
});

function isBlockingStatus(status: string) {
  return status !== "draft" && status !== "rejected";
}

export async function POST(req: NextRequest) {
  noStore();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRole(user, "shadchan") && !hasRole(user, "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const {
    groomId,
    brideId,
    action,
    recipientScope,
    noteForGroom,
    noteForBride,
    shareContactDetails,
    shareMedicalInfo,
  } = parsed.data;

  if (action === "send" && !recipientScope) {
    return NextResponse.json(
      { error: "recipientScope נדרש לשליחה" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const [{ data: groom, error: gErr }, { data: bride, error: bErr }] =
    await Promise.all([
      admin
        .from("students")
        .select("id, gender, user_id, first_name, last_name")
        .eq("id", groomId)
        .is("deleted_at", null)
        .single(),
      admin
        .from("students")
        .select("id, gender, user_id, first_name, last_name")
        .eq("id", brideId)
        .is("deleted_at", null)
        .single(),
    ]);

  if (gErr || !groom || bErr || !bride) {
    return NextResponse.json(
      { error: "לא נמצאו כרטיסי סטודנטים" },
      { status: 404 },
    );
  }

  if (groom.gender !== "male" || bride.gender !== "female") {
    return NextResponse.json(
      { error: "יש לבחור מיועד (זכר) ומיועדת (נקבה) בהתאמה" },
      { status: 400 },
    );
  }

  const { data: pairRows, error: pairErr } = await admin
    .from("shidduchim")
    .select(
      "id, status, shadchan_id, sent_at, note_for_groom, note_for_bride, recipient_scope, share_contact_details, share_medical_info",
    )
    .eq("groom_id", groomId)
    .eq("bride_id", brideId);

  if (pairErr) {
    console.error(pairErr);
    return NextResponse.json({ error: "שגיאת מסד" }, { status: 500 });
  }

  const rows = pairRows || [];
  const hasBlocking = rows.some((r) => isBlockingStatus(r.status));

  if (hasBlocking) {
    return NextResponse.json(
      {
        error:
          "לצמד הזה כבר קיימת הצעה פעילה או שהושלמה במערכת — לא ניתן לשמור או לשלוח שוב",
      },
      { status: 409 },
    );
  }

  const myDraft = rows.find(
    (r) => r.shadchan_id === user.id && r.status === "draft",
  );

  // unique_shidduch_pair מתיר שורה אחת לכל צמד. שורה שנדחתה כבר סגורה,
  // ולכן משתמשים בה מחדש (הבעלות עוברת לשדכן ששולח עכשיו). טיוטה של
  // שדכן אחר היא עבודה פעילה שלו — אותה לא דורסים בשקט.
  const reusableRejected = rows.find((r) => r.status === "rejected");
  const othersDraft = rows.find(
    (r) => r.shadchan_id !== user.id && r.status === "draft",
  );

  if (!myDraft && !reusableRejected && othersDraft) {
    return NextResponse.json(
      {
        error:
          "לצמד הזה כבר קיימת טיוטה של שדכן אחר — לא ניתן ליצור עבורו הצעה נוספת",
      },
      { status: 409 },
    );
  }

  /** השורה שאפשר לעדכן במקום להכניס חדשה */
  const rowToReuse = myDraft ?? reusableRejected ?? null;

  const shadchanName =
    `${user.user_metadata?.firstName || ""} ${user.user_metadata?.lastName || ""}`.trim() ||
    user.email ||
    "שדכן";

  if (action === "draft") {
    const payload = {
      groom_id: groomId,
      bride_id: brideId,
      shadchan_id: user.id,
      status: "draft" as const,
      note_for_groom: noteForGroom || null,
      note_for_bride: noteForBride || null,
      recipient_scope: null,
      sent_at: null,
      share_contact_details: shareContactDetails,
      share_medical_info: shareMedicalInfo,
    };

    if (rowToReuse) {
      const { data: updated, error: uErr } = await admin
        .from("shidduchim")
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rowToReuse.id)
        .select("id")
        .single();

      if (uErr || !updated) {
        console.error(uErr);
        return NextResponse.json(
          { error: "שגיאה בעדכון טיוטה" },
          { status: 500 },
        );
      }
      return NextResponse.json({ ok: true, id: updated.id, status: "draft" });
    }

    const { data: inserted, error: iErr } = await admin
      .from("shidduchim")
      .insert(payload)
      .select("id")
      .single();

    if (iErr || !inserted) {
      console.error(iErr);
      return NextResponse.json(
        { error: "שגיאה בשמירת טיוטה" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, id: inserted.id, status: "draft" });
  }

  const [{ data: groomAuth }, { data: brideAuth }] = await Promise.all([
    admin.auth.admin.getUserById(groom.user_id),
    admin.auth.admin.getUserById(bride.user_id),
  ]);

  const groomParentEmail = groomAuth.user?.email ?? null;
  const brideParentEmail = brideAuth.user?.email ?? null;

  const nowIso = new Date().toISOString();
  const sendPayloadBase = {
    groom_id: groomId,
    bride_id: brideId,
    shadchan_id: user.id,
    status: "sent" as const,
    note_for_groom: noteForGroom || null,
    note_for_bride: noteForBride || null,
    recipient_scope: recipientScope!,
    sent_at: null as string | null,
    updated_at: nowIso,
    share_contact_details: shareContactDetails,
    share_medical_info: shareMedicalInfo,
  };

  /**
   * מצב השורה לפני השליחה. שורה שנוצרה עכשיו (null) נמחקת אם המייל נכשל,
   * ושורה שהייתה קיימת מוחזרת למה שהייתה — כולל סטטוס rejected ובעלות של
   * שדכן אחר, שאסור שיישארו משונים רק מפני שהמייל לא יצא.
   */
  const previousState = rowToReuse
    ? {
        status: rowToReuse.status,
        shadchan_id: rowToReuse.shadchan_id,
        note_for_groom: rowToReuse.note_for_groom,
        note_for_bride: rowToReuse.note_for_bride,
        recipient_scope: rowToReuse.recipient_scope,
        sent_at: rowToReuse.sent_at,
        share_contact_details: rowToReuse.share_contact_details,
        share_medical_info: rowToReuse.share_medical_info,
      }
    : null;

  /** טיוטה משלי: שומרים את הנוסח שנכתב עכשיו, ורק מחזירים אותה לטיוטה */
  const reusedMyOwnDraft = !!myDraft && rowToReuse?.id === myDraft.id;

  let shidduchId: string;

  if (rowToReuse) {
    const { data: upgraded, error: uErr } = await admin
      .from("shidduchim")
      .update(sendPayloadBase)
      .eq("id", rowToReuse.id)
      .select("id")
      .single();

    if (uErr || !upgraded) {
      console.error(uErr);
      return NextResponse.json(
        { error: "שגיאה בהכנת רשומת השידוך לשליחה" },
        { status: 500 },
      );
    }
    shidduchId = upgraded.id;
  } else {
    const { data: inserted, error: iErr } = await admin
      .from("shidduchim")
      .insert(sendPayloadBase)
      .select("id")
      .single();

    if (iErr || !inserted) {
      console.error(iErr);
      return NextResponse.json(
        { error: "שגיאה בשמירת רשומת השידוך לפני שליחת המייל" },
        { status: 500 },
      );
    }
    shidduchId = inserted.id;
  }

  let sentTo: string[] = [];
  let sendGridMessageIds: string[] = [];

  try {
    const result = await sendShidduchOfferEmails({
      recipientScope: recipientScope!,
      groomParentEmail,
      brideParentEmail,
      // בכוונה בלי שמות המיועדים והערות: המייל רק מזמין להיכנס להצעה
      shadchanName,
      shidduchId,
    });
    sentTo = result.sentTo;
    sendGridMessageIds = result.sendGridMessageIds;
    if (process.env.NODE_ENV === "development") {
      console.info(
        "[shidduchim/offer] SendGrid sentTo:",
        sentTo,
        "messageIds:",
        sendGridMessageIds,
      );
    }
  } catch (e) {
    console.error(e);
    if (!previousState) {
      await admin.from("shidduchim").delete().eq("id", shidduchId);
    } else if (reusedMyOwnDraft) {
      await admin
        .from("shidduchim")
        .update({
          status: "draft",
          recipient_scope: null,
          sent_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", shidduchId);
    } else {
      await admin
        .from("shidduchim")
        .update({ ...previousState, updated_at: new Date().toISOString() })
        .eq("id", shidduchId);
    }
    const msg = e instanceof Error ? e.message : "שגיאת שליחה";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const sentAt = new Date().toISOString();
  const { error: finErr } = await admin
    .from("shidduchim")
    .update({ sent_at: sentAt, updated_at: sentAt })
    .eq("id", shidduchId);

  if (finErr) {
    console.error(finErr);
    return NextResponse.json(
      { error: "המייל נשלח אך עדכון חותמת השליחה נכשל — יש לפנות למנהל" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    id: shidduchId,
    status: "sent",
    // לא מחזירים כתובות מייל של ההורים: השדכן אינו אמור לראות אותן,
    // והן היו נחשפות בדפדפן גם בלי להופיע בהודעה. מספיק כמה נמענים.
    sentCount: sentTo.length,
  });
}
