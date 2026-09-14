// תמונות לדוגמה לגלריות המיועדים - לסביבה המקומית בלבד.
//
// יוצר תמונות placeholder מופשטות (צללית על רקע צבעוני, עם הכיתוב "תמונה
// לדוגמה") - בכוונה לא תמונות של אנשים אמיתיים - ומוסיף 2-4 מהן לכל כרטיס
// מקומי שעוד אין לו תמונות. מריצים אחרי `supabase db reset`:
//   pnpm seed:photos
//
// ה-PNG מרונדר ב-Chromium של Playwright (כבר מותקן לבדיקות), כדי לא להוסיף
// תלות רק בשביל זה.

import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "students";
const PHOTO_WIDTH = 600;
const PHOTO_HEIGHT = 800;
const MIN_PHOTOS_PER_STUDENT = 2;
const PHOTO_COUNT_SPREAD = 3; // 2, 3 או 4 תמונות לכרטיס

/** זוגות צבעים רכים לרקע - תמונות שונות זו מזו בגלריה */
const PALETTES = [
  ["#dbeafe", "#93c5fd"],
  ["#fce7f3", "#f9a8d4"],
  ["#dcfce7", "#86efac"],
  ["#fef3c7", "#fcd34d"],
  ["#ede9fe", "#c4b5fd"],
  ["#e0f2fe", "#7dd3fc"],
];

function assertLocalSupabase(url) {
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url ?? "")) {
    throw new Error(
      `הסקריפט רץ רק מול Supabase מקומי, והכתובת היא: ${url || "(ריקה)"}`,
    );
  }
}

function photoHtml(index) {
  const [from, to] = PALETTES[index % PALETTES.length];
  return `<!doctype html><html dir="rtl"><body style="margin:0">
    <div style="width:${PHOTO_WIDTH}px;height:${PHOTO_HEIGHT}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;background:linear-gradient(160deg,${from},${to});font-family:Arial,sans-serif">
      <svg width="260" height="300" viewBox="0 0 260 300" aria-hidden="true">
        <circle cx="130" cy="95" r="70" fill="rgba(255,255,255,0.85)"/>
        <path d="M20 300 C20 200 70 175 130 175 C190 175 240 200 240 300 Z" fill="rgba(255,255,255,0.85)"/>
      </svg>
      <div style="font-size:34px;font-weight:700;color:rgba(15,23,42,0.65)">תמונה לדוגמה ${index + 1}</div>
    </div>
  </body></html>`;
}

async function renderSamplePhotos(count) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: PHOTO_WIDTH, height: PHOTO_HEIGHT },
    });
    const photos = [];
    for (let index = 0; index < count; index += 1) {
      await page.setContent(photoHtml(index));
      photos.push(await page.screenshot({ type: "png" }));
    }
    return photos;
  } finally {
    await browser.close();
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  assertLocalSupabase(url);

  const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: students, error } = await supabase
    .from("students")
    .select("id, first_name, last_name, photo_count")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`שליפת הכרטיסים נכשלה: ${error.message}`);

  const targets = students.filter((student) => (student.photo_count ?? 0) === 0);
  if (targets.length === 0) {
    console.log("לכל הכרטיסים המקומיים כבר יש תמונות - אין מה להוסיף.");
    return;
  }

  const samplePhotos = await renderSamplePhotos(PALETTES.length);

  for (const [studentIndex, student] of targets.entries()) {
    const photoCount =
      MIN_PHOTOS_PER_STUDENT + (studentIndex % PHOTO_COUNT_SPREAD);
    const rows = [];

    for (let position = 0; position < photoCount; position += 1) {
      const path = `${student.id}/photos/sample-${position + 1}.png`;
      const photo =
        samplePhotos[(studentIndex + position) % samplePhotos.length];
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, photo, { contentType: "image/png", upsert: true });
      if (uploadError) {
        throw new Error(`העלאה נכשלה (${path}): ${uploadError.message}`);
      }
      rows.push({ student_id: student.id, storage_path: path, position });
    }

    const { error: insertError } = await supabase
      .from("student_photos")
      .upsert(rows, { onConflict: "student_id,storage_path" });
    if (insertError) {
      throw new Error(
        `שמירת הגלריה נכשלה (${student.id}): ${insertError.message}`,
      );
    }
    console.log(
      `✓ ${student.first_name} ${student.last_name}: ${rows.length} תמונות`,
    );
  }

  console.log(`נוספו תמונות לדוגמה ל-${targets.length} כרטיסים.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
