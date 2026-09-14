// מזיז את התמונות שהועברו מ-students.image_url לנתיב חדש תחת photos/.
//
// למה: image_url החזיק signed URL בתוקף לשנה, והוא נחשף לשדכנים ולאנשי צוות
// (גם של בנות). קישור חתום קשור לנתיב הקובץ - הזזה לנתיב חדש גורמת לכל
// הקישורים הישנים להחזיר 404, בלי לחכות שנה שיפוגו.
//
// בטוח להרצה חוזרת: מטפל רק בשורות שאינן תחת photos/.
// ברירת המחדל היא הרצה יבשה שמציגה מה ייעשה:
//   node --env-file=.env.cloud.local scripts/rotate-legacy-student-photos.mjs
//   node --env-file=.env.cloud.local scripts/rotate-legacy-student-photos.mjs --apply

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "students";
const MAX_EXTENSION_LENGTH = 5;
const DEFAULT_EXTENSION = "jpg";
const shouldApply = process.argv.includes("--apply");

function extensionOf(path) {
  const lastDot = path.lastIndexOf(".");
  const extension = lastDot > path.lastIndexOf("/") ? path.slice(lastDot + 1) : "";
  return extension && extension.length <= MAX_EXTENSION_LENGTH
    ? extension.toLowerCase()
    : DEFAULT_EXTENSION;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("חסרים NEXT_PUBLIC_SUPABASE_URL או SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`סביבה: ${new URL(url).host} · ${shouldApply ? "ביצוע" : "הרצה יבשה"}`);

  const { data: legacy, error } = await supabase
    .from("student_photos")
    .select("id, student_id, storage_path")
    .not("storage_path", "like", "%/photos/%");
  if (error) throw new Error(`שליפת התמונות נכשלה: ${error.message}`);

  if (legacy.length === 0) {
    console.log("אין תמונות ישנות להזזה.");
    return;
  }

  let moved = 0;
  for (const photo of legacy) {
    const newPath = `${photo.student_id}/photos/legacy-${randomUUID()}.${extensionOf(photo.storage_path)}`;
    console.log(`${shouldApply ? "מזיז" : "יוזז"}: ${photo.storage_path} → ${newPath}`);
    if (!shouldApply) continue;

    const { error: moveError } = await supabase.storage
      .from(BUCKET)
      .move(photo.storage_path, newPath);
    if (moveError) {
      throw new Error(`הזזה נכשלה (${photo.storage_path}): ${moveError.message}`);
    }

    const { error: updateError } = await supabase
      .from("student_photos")
      .update({ storage_path: newPath })
      .eq("id", photo.id);
    if (updateError) {
      // מחזירים את הקובץ, כדי שהשורה לא תצביע על נתיב שכבר אינו קיים
      await supabase.storage.from(BUCKET).move(newPath, photo.storage_path);
      throw new Error(`עדכון השורה נכשל (${photo.id}): ${updateError.message}`);
    }
    moved += 1;
  }

  console.log(
    shouldApply
      ? `הוזזו ${moved} תמונות. הקישורים הישנים אינם פעילים עוד.`
      : `${legacy.length} תמונות יוזזו. להרצה בפועל: --apply`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
