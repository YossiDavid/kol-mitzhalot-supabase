// מזיז את קבצי הקו"ח והמסמכים הרפואיים לנתיב חדש (ממצא 3 בסקירת האבטחה).
//
// למה: עד 20261108150000_student_files_as_paths.sql נשמר במסד קישור חתום לשנה.
// מי שקיבל אותו (הצד השני בהצעה שנסגרה, שדכן שהוקפא, כל מי שהקישור הועבר
// אליו) יכול לפתוח את הקובץ עד שיפוג. קישור חתום קשור לנתיב - הזזה לנתיב
// חדש גורמת לכל הקישורים הישנים להחזיר 404.
//
// להריץ אחרי ה-migration (הערכים במסד כבר נתיבים). קבצים שכבר הוזזו מסומנים
// ב-"/r-" בשם, ולכן ההרצה בטוחה לחזרה.
// ברירת המחדל היא הרצה יבשה שמציגה מה ייעשה:
//   node --env-file=.env.cloud.local scripts/rotate-student-documents.mjs
//   node --env-file=.env.cloud.local scripts/rotate-student-documents.mjs --apply

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "students";
const ROTATED_MARKER = "/r-";
const shouldApply = process.argv.includes("--apply");

function isRotated(path) {
  return path.includes(ROTATED_MARKER);
}

/** <student_id>/[medical/]<name> → אותה תיקייה, שם חדש עם סימון */
function rotatedPath(path) {
  const slash = path.lastIndexOf("/");
  const folder = path.slice(0, slash);
  const name = path.slice(slash + 1);
  return `${folder}/r-${randomUUID().slice(0, 8)}-${name}`;
}

async function move(supabase, from) {
  const to = rotatedPath(from);
  console.log(`${shouldApply ? "מזיז" : "יוזז"}: ${from} → ${to}`);
  if (!shouldApply) return to;
  const { error } = await supabase.storage.from(BUCKET).move(from, to);
  if (error) throw new Error(`הזזת ${from} נכשלה: ${error.message}`);
  return to;
}

async function rotateCvs(supabase) {
  const { data, error } = await supabase
    .from("students")
    .select("id, cv_url")
    .not("cv_url", "is", null);
  if (error) throw new Error(`שליפת קו"ח נכשלה: ${error.message}`);

  let count = 0;
  for (const row of data) {
    if (isRotated(row.cv_url) || row.cv_url.includes("://")) continue;
    const next = await move(supabase, row.cv_url);
    count += 1;
    if (!shouldApply) continue;
    const { error: updateError } = await supabase
      .from("students")
      .update({ cv_url: next })
      .eq("id", row.id);
    if (updateError) throw new Error(`עדכון ${row.id} נכשל: ${updateError.message}`);
  }
  return count;
}

async function rotateMedical(supabase) {
  const { data, error } = await supabase
    .from("medical_records")
    .select("id, documents")
    .not("documents", "is", null);
  if (error) throw new Error(`שליפת מסמכים נכשלה: ${error.message}`);

  let count = 0;
  for (const row of data) {
    const documents = row.documents ?? [];
    if (documents.every((path) => isRotated(path) || path.includes("://"))) continue;
    const next = [];
    for (const path of documents) {
      if (isRotated(path) || path.includes("://")) {
        next.push(path);
        continue;
      }
      next.push(await move(supabase, path));
      count += 1;
    }
    if (!shouldApply) continue;
    const { error: updateError } = await supabase
      .from("medical_records")
      .update({ documents: next })
      .eq("id", row.id);
    if (updateError) throw new Error(`עדכון ${row.id} נכשל: ${updateError.message}`);
  }
  return count;
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

  const cvs = await rotateCvs(supabase);
  const documents = await rotateMedical(supabase);
  console.log(`קו"ח: ${cvs} · מסמכים רפואיים: ${documents}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
