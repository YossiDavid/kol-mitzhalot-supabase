"use client";

// Importers: admin content hub Link. API: contact_submissions CRUD via supabase client.
// Schema: public.contact_submissions. User: "3. לחבר את הטפסים למערכת הניהול ולDB."

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DashboardSection, Box } from "@/components/layout";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Archive, Eye, Mail } from "lucide-react";

type Submission = {
  id: string;
  type: "contact" | "shidduch_idea";
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string | null;
  payload: Record<string, unknown>;
  status: "new" | "read" | "archived";
  created_at: string;
};

const TYPE_LABEL: Record<Submission["type"], string> = {
  contact: "פנייה כללית",
  shidduch_idea: "רעיון לשידוך",
};

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

function ShidduchIdeaDetails({
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

export default function SubmissionsAdminPage() {
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "new" | "read" | "archived">(
    "all",
  );
  const [selected, setSelected] = useState<Submission | null>(null);
  const supabase = createClient();

  async function load() {
    setLoading(true);
    let query = supabase
      .from("contact_submissions")
      .select("*")
      .order("created_at", { ascending: false });
    if (filter !== "all") query = query.eq("status", filter);
    const { data, error } = await query;
    if (error) toast.error("שגיאה בטעינה");
    else setItems((data as Submission[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [filter]);

  async function setStatus(id: string, status: Submission["status"]) {
    const { error } = await supabase
      .from("contact_submissions")
      .update({ status })
      .eq("id", id);
    if (error) toast.error("שגיאה בעדכון");
    else {
      toast.success("עודכן");
      if (selected?.id === id) setSelected({ ...selected, status });
      load();
    }
  }

  return (
    <div className="space-y-10 py-4">
      <DashboardSection
        title="פניות מהאתר"
        subTitle="טפסי צור קשר ורעיונות לשידוך"
        button={
          <Button asChild variant="outline">
            <Link href={"/app/admin/content" as any}>חזרה</Link>
          </Button>
        }
      >
        <div className="mt-4 flex flex-wrap gap-2">
          {(["all", "new", "read", "archived"] as const).map((key) => (
            <Button
              key={key}
              size="sm"
              variant={filter === key ? "default" : "outline"}
              onClick={() => setFilter(key)}
            >
              {key === "all"
                ? "הכל"
                : key === "new"
                  ? "חדש"
                  : key === "read"
                    ? "נקרא"
                    : "בארכיון"}
            </Button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Box>
            {loading ? (
              <div className="py-10 text-center text-muted-foreground">
                טוען...
              </div>
            ) : items.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                אין פניות להצגה
              </div>
            ) : (
              <div className="divide-y">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full flex-col gap-1 py-4 text-start hover:bg-accent/40"
                    onClick={() => {
                      setSelected(item);
                      if (item.status === "new") setStatus(item.id, "read");
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{item.name}</span>
                      <span className="text-caption text-muted-foreground">
                        {new Date(item.created_at).toLocaleString("he-IL")}
                      </span>
                    </div>
                    <p className="text-body-sm text-muted-foreground">
                      {TYPE_LABEL[item.type]}
                      {item.subject ? ` · ${item.subject}` : ""}
                    </p>
                    <span
                      className={`w-fit rounded-full px-2 py-0.5 text-caption font-semibold ${
                        item.status === "new"
                          ? "bg-green-100 text-green-700"
                          : item.status === "read"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {item.status === "new"
                        ? "חדש"
                        : item.status === "read"
                          ? "נקרא"
                          : "ארכיון"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Box>

          <Box>
            {!selected ? (
              <div className="flex h-full min-h-48 items-center justify-center text-muted-foreground">
                בחרו פנייה לצפייה
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStatus(selected.id, "read")}
                  >
                    <Eye className="me-1 h-4 w-4" />
                    סמן כנקרא
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStatus(selected.id, "archived")}
                  >
                    <Archive className="me-1 h-4 w-4" />
                    לארכיון
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={`mailto:${selected.email}`}>
                      <Mail className="me-1 h-4 w-4" />
                      מייל
                    </a>
                  </Button>
                </div>
                <p className="text-subtitle font-bold">{selected.name}</p>
                <p className="text-body-sm text-muted-foreground">
                  {selected.email}
                  {selected.phone ? ` · ${selected.phone}` : ""}
                </p>
                <p className="text-body-sm font-semibold">
                  {TYPE_LABEL[selected.type]}
                  {selected.subject ? ` — ${selected.subject}` : ""}
                </p>
                {selected.message ? (
                  <p className="text-body leading-relaxed whitespace-pre-wrap">
                    {selected.message}
                  </p>
                ) : null}
                {selected.type === "shidduch_idea" && selected.payload ? (
                  <ShidduchIdeaDetails
                    payload={selected.payload}
                    message={selected.message}
                  />
                ) : null}
              </div>
            )}
          </Box>
        </div>
      </DashboardSection>
    </div>
  );
}
