import {
  INSTITUTION_GENDERS,
  INSTITUTION_TYPES,
  type InstitutionGender,
  type InstitutionType,
} from "./institution-labels";

/** שדות המערכת שאפשר למפות אליהם עמודה מהקובץ */
export const IMPORT_TARGETS = ["name", "city", "gender", "type"] as const;
export type ImportTarget = (typeof IMPORT_TARGETS)[number];

export const IMPORT_TARGET_LABELS: Record<ImportTarget, string> = {
  name: "שם המוסד",
  city: "עיר",
  gender: "מגדר",
  type: "סוג מוסד",
};

/** name בלבד חובה — השאר ניתנים להשלמה מברירת מחדל */
export const REQUIRED_TARGETS: ImportTarget[] = ["name"];

export type SheetData = {
  headers: string[];
  rows: string[][];
};

/**
 * קורא את הגיליון הראשון. exceljs נטען דינמית כדי שהחבילה
 * (כ-900KB) לא תיכנס לבאנדל של מסכים שלא מייבאים.
 */
export async function readSpreadsheet(file: File): Promise<SheetData> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("לא נמצא גיליון בקובץ");

  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values: string[] = [];
    // eachCell מדלג על תאים ריקים, ולכן קוראים לפי אינדקס כדי
    // לשמור על יישור בין העמודות לכותרות.
    for (let i = 1; i <= sheet.columnCount; i += 1) {
      const cell = row.getCell(i);
      const v = cell.value;
      values.push(v === null || v === undefined ? "" : String(v).trim());
    }
    rows.push(values);
  });

  if (rows.length === 0) throw new Error("הגיליון ריק");

  const headers = rows[0].map((h, i) => h || `עמודה ${i + 1}`);
  const body = rows.slice(1).filter((r) => r.some((c) => c !== ""));

  return { headers, rows: body };
}

/** ניחוש ראשוני של מיפוי עמודה→שדה, לפי מילות מפתח בכותרת */
const HEADER_HINTS: Record<ImportTarget, RegExp> = {
  name: /שם|name|מוסד|institution/i,
  city: /עיר|city|ישוב|יישוב|location/i,
  gender: /מגדר|מין|gender|בנים|בנות/i,
  type: /סוג|type|קטגור/i,
};

export function guessMapping(headers: string[]): Record<ImportTarget, number> {
  const mapping = {} as Record<ImportTarget, number>;
  const used = new Set<number>();

  for (const target of IMPORT_TARGETS) {
    const idx = headers.findIndex(
      (h, i) => !used.has(i) && HEADER_HINTS[target].test(h),
    );
    mapping[target] = idx;
    if (idx >= 0) used.add(idx);
  }
  return mapping;
}

/** ערכים נפוצים בעברית ובאנגלית לכל סוג מוסד */
const TYPE_SYNONYMS: Record<InstitutionType, RegExp> = {
  yeshiva_gedola: /ישיבה גדולה|ישיבה גבוהה|gedola|gdola/i,
  yeshiva_ketana: /ישיבה קטנה|ketana|ktana/i,
  seminary: /סמינר|seminar/i,
  school: /בית ספר|בי"ס|ביה"ס|school/i,
  talmud_torah: /תלמוד תורה|ת"ת|talmud/i,
  kollel: /כולל|kollel|kolel/i,
  other: /אחר|other/i,
};

const GENDER_SYNONYMS: Record<InstitutionGender, RegExp> = {
  male: /בנים|זכר|גבר|בחור|male|boy|^m$/i,
  female: /בנות|נקבה|אישה|בחורה|female|girl|^f$/i,
};

/** ערכים ייחודיים בעמודה, לצורך מיפוי ידני של סוג/מגדר */
export function distinctValues(rows: string[][], columnIndex: number) {
  if (columnIndex < 0) return [];
  const seen = new Set<string>();
  for (const row of rows) {
    const v = (row[columnIndex] ?? "").trim();
    if (v) seen.add(v);
  }
  return [...seen].sort((a, b) => a.localeCompare(b, "he"));
}

export function guessType(value: string): InstitutionType | "" {
  return INSTITUTION_TYPES.find((t) => TYPE_SYNONYMS[t].test(value)) ?? "";
}

export function guessGender(value: string): InstitutionGender | "" {
  return INSTITUTION_GENDERS.find((g) => GENDER_SYNONYMS[g].test(value)) ?? "";
}

export type ParsedRow = {
  name: string;
  city: string | null;
  gender: InstitutionGender;
  type: InstitutionType;
};

export type BuildResult = {
  valid: ParsedRow[];
  /** שורות שנפסלו, עם הסיבה — מוצגות למשתמש לפני הייבוא */
  skipped: { row: number; reason: string }[];
};

/**
 * בונה את הרשומות לייבוא לפי המיפוי שנבחר. שורה בלי שם נפסלת;
 * מגדר או סוג שלא מופו נופלים לברירת המחדל שנבחרה במסך.
 */
export function buildRows(
  sheet: SheetData,
  mapping: Record<ImportTarget, number>,
  typeMap: Record<string, InstitutionType | "">,
  genderMap: Record<string, InstitutionGender | "">,
  fallback: { gender: InstitutionGender; type: InstitutionType },
): BuildResult {
  const valid: ParsedRow[] = [];
  const skipped: { row: number; reason: string }[] = [];

  sheet.rows.forEach((row, i) => {
    const rowNumber = i + 2; // +1 לכותרת, +1 לאינדוקס מאחד
    const cell = (t: ImportTarget) =>
      mapping[t] >= 0 ? (row[mapping[t]] ?? "").trim() : "";

    const name = cell("name");
    if (!name) {
      skipped.push({ row: rowNumber, reason: "אין שם מוסד" });
      return;
    }

    const rawType = cell("type");
    const rawGender = cell("gender");

    valid.push({
      name,
      city: cell("city") || null,
      gender: (rawGender && genderMap[rawGender]) || fallback.gender,
      type: (rawType && typeMap[rawType]) || fallback.type,
    });
  });

  return { valid, skipped };
}

/** כפילות בתוך הקובץ עצמו: אותו שם + עיר + מגדר */
export function dedupe(rows: ParsedRow[]) {
  const seen = new Set<string>();
  const unique: ParsedRow[] = [];
  let duplicates = 0;

  for (const r of rows) {
    const key = `${r.name.toLowerCase()}|${(r.city ?? "").toLowerCase()}|${r.gender}`;
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    unique.push(r);
  }
  return { unique, duplicates };
}
