// פרטי "רעיון לשידוך" מתוך payload של contact_submissions (חלון הפנייה בניהול).

// שדות המיועד/ת בתוך payload של "רעיון לשידוך". yeshiva קיים רק אצל הבחור
// ו-seminary רק אצל הבחורה — מי שאין לו ערך פשוט לא מוצג.
const PERSON_FIELDS = [
  { key: "name", label: "שם" },
  { key: "father", label: "שם האב" },
  { key: "city", label: "עיר" },
  { key: "yeshiva", label: "ישיבה" },
  { key: "seminary", label: "סמינר" },
  { key: "age", label: "גיל" },
  { key: "status", label: "מצב אישי" },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function PersonDetails({ title, person }: { title: string; person: unknown }) {
  if (!isRecord(person)) return null;

  const rows = PERSON_FIELDS.map((field) => ({
    label: field.label,
    value: person[field.key],
  })).filter(
    (row) =>
      row.value !== undefined &&
      row.value !== null &&
      String(row.value).trim() !== "",
  );

  if (rows.length === 0) return null;

  return (
    <div className="rounded-md border p-3">
      <p className="mb-2 text-body-sm font-bold">{title}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col">
            <dt className="text-caption text-muted-foreground">{row.label}</dt>
            <dd className="text-body-sm font-semibold">{String(row.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ShidduchIdeaDetails({
  payload,
  message,
}: {
  payload: Record<string, unknown>;
  message: string | null;
}) {
  const male = payload.intended_male;
  const female = payload.intended_female;

  // מבנה לא מוכר — עדיף להציג את הנתונים הגולמיים מאשר להסתיר מידע
  if (!isRecord(male) && !isRecord(female)) {
    return (
      <pre
        className="overflow-auto rounded-md bg-muted p-3 text-caption"
        dir="ltr"
      >
        {JSON.stringify(payload, null, 2)}
      </pre>
    );
  }

  const reason = typeof payload.reason === "string" ? payload.reason : "";
  // reason נשמר גם בעמודה message ומוצג למעלה — מציגים רק אם הוא שונה
  const showReason = reason.trim() !== "" && reason !== message;

  return (
    <div className="space-y-3">
      <PersonDetails title="המיועד" person={male} />
      <PersonDetails title="המיועדת" person={female} />
      {showReason && (
        <div className="rounded-md border p-3">
          <p className="mb-1 text-body-sm font-bold">סיבת ההצעה</p>
          <p className="text-body-sm leading-relaxed whitespace-pre-wrap">
            {reason}
          </p>
        </div>
      )}
      {typeof payload.accompany === "boolean" && (
        <p className="text-body-sm">
          <span className="text-muted-foreground">
            מוכן/ה ללוות את השידוך:{" "}
          </span>
          <span className="font-semibold">
            {payload.accompany ? "כן" : "לא"}
          </span>
        </p>
      )}
    </div>
  );
}
