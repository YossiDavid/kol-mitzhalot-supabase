import { Box } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import calculateAge from "@/lib/calculateAge";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasRole } from "@/lib/user";
import { formatFullName, resolveDisplayName } from "@/lib/user-display-name";
import {
  User,
  Phone,
  GraduationCap,
  Briefcase,
  Heart,
  Users,
  FileText,
  Info,
  Calendar,
  Stethoscope,
  Star,
  Mail,
  ChevronRight,
  Lock,
  ImageIcon,
  MessageSquareText,
} from "lucide-react";
import Link from "next/link";
import ShareButton from "@/features/students/components/share-button";
import MessageButton from "@/features/students/components/message-button";
import DeleteStudentButton from "@/features/students/components/delete-student-button";
import StudentPhoto from "@/features/students/components/student-photo";
import StudentNotes, {
  type Note,
} from "@/features/students/components/student-notes";
import StatusUpdateButton from "./status-update-button";
import { jewishDateHebrew } from "@/lib/jewishDatte";
import {
  eduToHebrew,
  employmentCategoryToHebrew,
  cellphoneTypeToHebrew,
  exposureLevelToHebrew,
  headCoverTypeToHebrew,
  medicalStatusToHebrew,
  parentsStatusToHebrew,
  personalStatusToHebrew,
  planForLifeToHebrew,
  referenceTypeToHebrew,
  relatedIssuePreferenceToHebrew,
  workStatusToHebrew,
} from "@/features/students/lib/profile-labels";
import { unstable_noStore as noStore } from "next/cache";

// הערה: אין כאן export const dynamic — הוא אסור תחת Cache Components
// (next.config: cacheComponents) והבנייה נכשלת עליו. גם אין בו צורך:
// ללא "use cache" שום דבר אינו נשמר בקאש המשותף, ותוכן שתלוי ב-cookies
// או headers הוא session-specific ממילא.
import { cn } from "@/lib/utils";

type IconComponent = React.ComponentType<{
  size?: number;
  className?: string;
}>;

// Section/InfoTag הוצאו החוצה מהקומפוננטה (לא תלויים ב-state/props של הדף)
// כדי שגם התצוגה הציבורית (משתמש לא מחובר) תוכל להשתמש בהם ולהיראות כמו
// אותו כרטיס. שום שינוי בהתנהגות - זו רק העברת scope.
function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: IconComponent;
  children: React.ReactNode;
}) {
  return (
    <Box className="space-y-4">
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <div className="rounded-lg bg-muted p-2">
          <Icon size={20} className="text-primary" />
        </div>
        <h2 className="text-title! font-bold!">{title}</h2>
      </div>
      {children}
    </Box>
  );
}

function InfoTag({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex flex-col">
      <span className="text-caption font-medium text-muted-foreground">
        {label}
      </span>
      <span className="text-body-sm font-semibold text-foreground">
        {value}
      </span>
    </div>
  );
}

// שורת ה-DB הגולמית שנשלפת ב-select המצומצם למשתמש לא מחובר. חייבת להישאר
// תואמת בדיוק לרשימת השדות שנבחרים ב-query - שום שדה רגיש (ת.ז./טלפון/סוג
// מכשיר/רחוב/בית/קו"ח/user_id/institution_id) לא מופיע כאן.
type AnonymousStudentRow = {
  id: string;
  first_name: string;
  last_name: string;
  gender: string | null;
  personal_status: string | null;
  city: string | null;
  height: number | null;
  community: string | null;
  shtible: string | null;
  plan_for_life: string | null;
  head_cover_type: string | null;
  about: string | null;
  parents_info: Record<string, any> | null;
  family_info: Record<string, any> | null;
  author_info: Record<string, any> | null;
  image_url: string | null;
  birth_date: string | null;
  deleted_at: string | null;
  education_history: Array<Record<string, any>> | null;
  employment_history: Array<Record<string, any>> | null;
};

// אובייקט התצוגה הציבורי בפועל - בלי birth_date (הוחלף בגיל מספרי) ובלי
// deleted_at. image_url הוא המפתח היחיד שמתווסף בתנאי.
type PublicStudent = Omit<
  AnonymousStudentRow,
  "birth_date" | "deleted_at" | "image_url"
> & {
  age: number | null;
  image_url?: string;
};

/**
 * בונה את אובייקט התצוגה הציבורי מתוך שורת ה-DB הגולמית שנשלפה עבור משתמש
 * לא מחובר. זהו המקום היחיד שבו birth_date נהפך לגיל (מספר, דרך
 * lib/calculateAge.ts) ולאחר מכן נשמט - הגיל המדויק/תאריך הלידה לעולם לא
 * מגיע ל-JSX ולכן לא יכול לדלוף דרך ה-payload המסודר (serialized) של ה-HTML.
 * deleted_at נשמט גם הוא (שימש רק לסינון ב-query).
 *
 * כלל מוחלט: image_url נכנס לאובייקט המוחזר רק כאשר gender === "male".
 * עבור כרטיס של בת המפתח image_url לא קיים בכלל באובייקט - לא רק "ריק" או
 * "לא מוצג ב-JSX" - כדי שלא תהיה שום דרך שבה הוא יזלוג ל-HTML הנשלח ללקוח.
 */
function buildPublicStudent(row: AnonymousStudentRow): PublicStudent {
  const { birth_date, deleted_at, image_url, ...rest } = row;
  // deleted_at שימש רק לסינון ב-query (is deleted_at null) - כאן הוא נשמט
  // באופן מכוון ולא אמור להגיע לעולם ל-JSX; שורת ה-void רק "מסמנת" אותו
  // כבשימוש עבור ה-linter.
  void deleted_at;
  const age = birth_date ? Number(calculateAge(birth_date)) : null;
  return {
    ...rest,
    age,
    ...(row.gender === "male" && image_url ? { image_url } : {}),
  };
}

// שליפת מחמאות/הערות למיועד + שם תצוגה לכל מחבר. הקריאה עצמה עוברת דרך
// הלקוח המשויך למשתמש (RLS מסנן מי רואה מה - ראה
// supabase/migrations/20260830170000_student_notes.sql), ורק פענוח השם של
// כל מחבר (auth.users + user_profiles) דורש את לקוח ה-admin, כמו ב-
// features/admin/lib/users.ts.
async function loadStudentNotes(studentId: string): Promise<Note[]> {
  const supabase = await createClient();
  const { data: rows, error: notesError } = await supabase
    .from("student_notes")
    .select(
      "id, body, created_at, author_id, author_role, author_institution_id, institutions(name, city, type)",
    )
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  if (notesError) {
    console.error("[students/notes]", notesError);
    return [];
  }
  if (!rows || rows.length === 0) return [];

  const admin = createAdminClient();
  const authorIds = Array.from(new Set(rows.map((row) => row.author_id)));

  const { data: profiles, error: profilesError } = await admin
    .from("user_profiles")
    .select("id, first_name, last_name")
    .in("id", authorIds);

  if (profilesError) {
    console.error("[students/notes] user_profiles", profilesError);
  }

  const profileMap = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      { first_name: profile.first_name, last_name: profile.last_name },
    ]),
  );

  const nameMap = new Map<string, string>();
  await Promise.all(
    authorIds.map(async (authorId) => {
      try {
        const { data: authorData, error: authorError } =
          await admin.auth.admin.getUserById(authorId);
        if (authorError || !authorData.user) {
          nameMap.set(authorId, "משתמש");
          return;
        }
        const { firstName, lastName } = resolveDisplayName(
          authorData.user,
          profileMap.get(authorId) ?? null,
        );
        nameMap.set(authorId, formatFullName(firstName, lastName) || "משתמש");
      } catch (err) {
        console.error("[students/notes] author lookup", err);
        nameMap.set(authorId, "משתמש");
      }
    }),
  );

  return rows.map((row) => {
    // PostgREST מחזיר את ה-embed כאובייקט יחיד (יחס many-to-one), אך ה-SDK
    // מקליד אותו כמערך כשאין Database type - מנרמלים לאיבר הראשון בלבד
    // (זהה לדפוס ב-features/settings/components/staff-card.tsx).
    const institution = Array.isArray(row.institutions)
      ? (row.institutions[0] ?? null)
      : row.institutions;

    return {
      id: row.id,
      body: row.body,
      created_at: row.created_at,
      author_name: nameMap.get(row.author_id) ?? "משתמש",
      author_role: row.author_role,
      author_institution: institution,
    };
  });
}

export default async function StudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  noStore();
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // חייב להיקבע לפני שליפת המידע - קובע אילו עמודות/embeds מותר בכלל
  // לשלוף (ראה ההערה על AnonymousStudentRow למעלה). זה לא רק "מה מוצג
  // ב-JSX" - Server Component מסדרר (serialize) כל מה שנשלף להטבעה ב-HTML,
  // ולכן הגבלת מידע חייבת לקרות כבר ברמת ה-query, לא רק בתצוגה.
  const isAnonymous = !user;

  const { data, error } = isAnonymous
    ? await createAdminClient()
        .from("students")
        .select(
          `id, first_name, last_name, gender, personal_status, city, height, community, shtible, plan_for_life, head_cover_type, about, parents_info, family_info, author_info, image_url, birth_date, deleted_at,
			education_history(*),
			employment_history(*)
		`,
        )
        .eq("id", id)
        // אין RLS למשתמש anon (זה client עם service role) - הסינון על
        // deleted_at חייב לקרות כאן במפורש, אחרת כרטיס שנמחק "רך" יחשף.
        .is("deleted_at", null)
        .single()
    : await supabase
        .from("students")
        .select(
          `*,
		education_history(*),
		employment_history(*),
		medical_records(*),
		partner_preferences(*),
		references(*),
		previous_partners(*)
	`,
        )
        .eq("id", id)
        .single();

  const isShadchan = hasRole(user, "shadchan") || hasRole(user, "admin");
  const isAdmin = hasRole(user, "admin");

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="space-y-2 text-center">
          <p className="font-semibold text-destructive">שגיאה בטעינת הפרופיל</p>
          <p className="text-body-sm text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  const student = data;
  if (!student) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="space-y-2 text-center">
          <p className="font-semibold text-foreground">מיועד לא נמצא</p>
          <p className="text-body-sm text-muted-foreground">
            הרשומה שחיפשת אינה קיימת במערכת
          </p>
        </div>
      </div>
    );
  }

  // --- ענף ציבורי (משתמש לא מחובר) --------------------------------------
  // התצוגה מוגבלת: אין שורת פעולות, אין הערות, ואין מקטעי "מה אני מחפש"/
  // "הצהרה רפואית"/"ממליצים"/"נישואין קודמים" - כי הטבלאות שמזינות אותם לא
  // נשלפו כלל (ראה ה-select הציבורי למעלה). מוחזר כאן ולא ממשיך לקוד של
  // המשתמש המחובר למטה, כדי שהקוד של המשתמש המחובר יישאר ללא שינוי.
  if (isAnonymous) {
    const publicStudent = buildPublicStudent(student as AnonymousStudentRow);

    const genderLabel =
      publicStudent.gender === "male"
        ? "זכר"
        : publicStudent.gender === "female"
          ? "נקבה"
          : null;

    // כלל מוחלט: אצל בת לעולם לא מוצגת תמונה בדף הציבורי (גם אם איכשהו
    // תגיע לכאן) - publicStudent.image_url ממילא לא קיים במקרה הזה
    // (ראה buildPublicStudent), זו רק הגנה כפולה בשכבת התצוגה.
    const showMalePhoto =
      publicStudent.gender === "male" && !!publicStudent.image_url;
    const showFemaleLockPlaceholder = publicStudent.gender === "female";

    return (
      <div className="min-h-screen space-y-6 text-right">
        {/* Back */}
        <Link
          href="/app/students"
          className="inline-flex items-center gap-1 text-body-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
          חזרה לרשימה
        </Link>

        {/* Hero */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="shrink-0">
            {showFemaleLockPlaceholder ? (
              <div className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-full border bg-muted sm:h-24 sm:w-24">
                <Lock className="h-6 w-6 text-muted-foreground" />
                <span className="text-caption text-muted-foreground">חסוי</span>
              </div>
            ) : showMalePhoto ? (
              <StudentPhoto
                src={publicStudent.image_url!}
                alt={`${publicStudent.first_name} ${publicStudent.last_name}`}
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border bg-muted sm:h-24 sm:w-24">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-heading! leading-tight! font-bold!">
              {publicStudent.first_name} {publicStudent.last_name}
            </h1>
            <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-body-sm text-muted-foreground">
              {genderLabel && <span>{genderLabel}</span>}
              {publicStudent.age !== null && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span>גיל {publicStudent.age}</span>
                </>
              )}
              {publicStudent.personal_status && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span>
                    {personalStatusToHebrew(
                      publicStudent.personal_status,
                      publicStudent.gender ?? undefined,
                    )}
                  </span>
                </>
              )}
              {publicStudent.city && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span>{publicStudent.city}</span>
                </>
              )}
              {publicStudent.height && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span>{publicStudent.height} ס"מ</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* פרטים אישיים - ללא ת.ז./טלפון/סוג מכשיר/רחוב/בית (לא נשלפו בכלל) */}
        <Section title="פרטים אישיים" icon={User}>
          {publicStudent.about && (
            <p className="leading-relaxed text-muted-foreground">
              {publicStudent.about}
            </p>
          )}
          <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4 sm:grid-cols-3 lg:grid-cols-4">
            {genderLabel && <InfoTag label="מגדר" value={genderLabel} />}
            <InfoTag label="עיר" value={publicStudent.city} />
            <InfoTag
              label="גיל"
              value={
                publicStudent.age !== null ? `${publicStudent.age} שנים` : null
              }
            />
            <InfoTag
              label="סטטוס אישי"
              value={
                publicStudent.personal_status
                  ? personalStatusToHebrew(
                      publicStudent.personal_status,
                      publicStudent.gender ?? undefined,
                    )
                  : null
              }
            />
            {publicStudent.height && (
              <InfoTag label="גובה" value={`${publicStudent.height} ס"מ`} />
            )}
            {publicStudent.community && (
              <InfoTag label="קהילה" value={publicStudent.community} />
            )}
            {publicStudent.shtible && (
              <InfoTag label="שטיבל" value={publicStudent.shtible} />
            )}
            {publicStudent.plan_for_life && (
              <InfoTag
                label="תכנון לחיים"
                value={planForLifeToHebrew(publicStudent.plan_for_life)}
              />
            )}
            {publicStudent.head_cover_type && (
              <InfoTag
                label="סוג כיסוי ראש"
                value={headCoverTypeToHebrew(publicStudent.head_cover_type)}
              />
            )}
          </div>
        </Section>

        {/* Main Content */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Main Column */}
          <div className="space-y-6 lg:col-span-3">
            {/* Family Background */}
            <Section title="רקע משפחתי" icon={Users}>
              <div className="space-y-6">
                {/* Parents */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Father */}
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <p className="mb-2 text-caption font-bold text-muted-foreground uppercase">
                      אבא
                    </p>
                    <p className="font-bold">
                      {publicStudent.parents_info?.father?.self?.prefix || ""}{" "}
                      {publicStudent.parents_info?.father?.self?.name || ""}{" "}
                      {publicStudent.parents_info?.father?.self?.suffix || ""}
                    </p>
                    {publicStudent.parents_info?.father?.job && (
                      <p className="mt-1 text-body-sm text-muted-foreground italic">
                        {publicStudent.parents_info.father.job}
                      </p>
                    )}
                    {publicStudent.parents_info?.father?.phone && (
                      <a
                        href={`tel:${publicStudent.parents_info.father.phone}`}
                        className="mt-2 flex items-center gap-1 text-caption text-muted-foreground hover:text-primary"
                      >
                        <Phone size={12} />{" "}
                        {publicStudent.parents_info.father.phone}
                      </a>
                    )}
                    {publicStudent.parents_info?.father?.email && (
                      <a
                        href={`mailto:${publicStudent.parents_info.father.email}`}
                        className="mt-1 flex items-center gap-1 text-caption text-muted-foreground hover:text-primary"
                      >
                        <Mail size={12} />{" "}
                        {publicStudent.parents_info.father.email}
                      </a>
                    )}
                    {/* Grandfather */}
                    {publicStudent.parents_info?.father?.grandFather && (
                      <div className="mt-3 border-t border-border pt-3">
                        <p className="text-caption text-muted-foreground">
                          אביו:
                        </p>
                        <p className="text-body-sm">
                          {publicStudent.parents_info.father.grandFather
                            .prefix || ""}{" "}
                          {publicStudent.parents_info.father.grandFather.name ||
                            ""}{" "}
                          {publicStudent.parents_info.father.grandFather
                            .suffix || ""}
                        </p>
                      </div>
                    )}
                    {/* Grandmother */}
                    {publicStudent.parents_info?.father?.grandMother && (
                      <div className="mt-2">
                        <p className="text-caption text-muted-foreground">
                          אמו:
                        </p>
                        <p className="text-body-sm">
                          {publicStudent.parents_info.father.grandMother
                            .prefix || ""}{" "}
                          {publicStudent.parents_info.father.grandMother.name ||
                            ""}{" "}
                          {publicStudent.parents_info.father.grandMother
                            .suffix || ""}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Mother */}
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <p className="mb-2 text-caption font-bold text-muted-foreground uppercase">
                      אמא
                    </p>
                    <p className="font-bold">
                      {publicStudent.parents_info?.mother?.self?.prefix || ""}{" "}
                      {publicStudent.parents_info?.mother?.self?.name || ""}{" "}
                      {publicStudent.parents_info?.mother?.self?.suffix || ""}
                      {publicStudent.parents_info?.mother?.maidenName && (
                        <span className="text-body-sm font-normal text-muted-foreground">
                          {" "}
                          | לבית {publicStudent.parents_info.mother.maidenName}
                        </span>
                      )}
                    </p>
                    {publicStudent.parents_info?.mother?.job && (
                      <p className="mt-1 text-body-sm text-muted-foreground">
                        {publicStudent.parents_info.mother.job}
                      </p>
                    )}
                    {publicStudent.parents_info?.mother?.phone && (
                      <a
                        href={`tel:${publicStudent.parents_info.mother.phone}`}
                        className="mt-2 flex items-center gap-1 text-caption text-muted-foreground hover:text-primary"
                      >
                        <Phone size={12} />{" "}
                        {publicStudent.parents_info.mother.phone}
                      </a>
                    )}
                    {publicStudent.parents_info?.mother?.email && (
                      <a
                        href={`mailto:${publicStudent.parents_info.mother.email}`}
                        className="mt-1 flex items-center gap-1 text-caption text-muted-foreground hover:text-primary"
                      >
                        <Mail size={12} />{" "}
                        {publicStudent.parents_info.mother.email}
                      </a>
                    )}
                    {publicStudent.parents_info?.deadParent === "mother" &&
                      publicStudent.parents_info?.motherDeathDate && (
                        <p className="mt-2 text-caption text-destructive">
                          נפטרה ב-
                          {jewishDateHebrew(
                            publicStudent.parents_info.motherDeathDate,
                          )}
                        </p>
                      )}
                    {/* Grandfather */}
                    {publicStudent.parents_info?.mother?.grandFather && (
                      <div className="mt-3 border-t border-border pt-3">
                        <p className="text-caption text-muted-foreground">
                          אביה:
                        </p>
                        <p className="text-body-sm">
                          {publicStudent.parents_info.mother.grandFather
                            .prefix || ""}{" "}
                          {publicStudent.parents_info.mother.grandFather.name ||
                            ""}{" "}
                          {publicStudent.parents_info.mother.grandFather
                            .suffix || ""}
                        </p>
                      </div>
                    )}
                    {/* Grandmother */}
                    {publicStudent.parents_info?.mother?.grandMother && (
                      <div className="mt-2">
                        <p className="text-caption text-muted-foreground">
                          אימה:
                        </p>
                        <p className="text-body-sm">
                          {publicStudent.parents_info.mother.grandMother
                            .prefix || ""}{" "}
                          {publicStudent.parents_info.mother.grandMother.name ||
                            ""}{" "}
                          {publicStudent.parents_info.mother.grandMother
                            .suffix || ""}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Parents Status */}
                {publicStudent.parents_info?.status && (
                  <div className="rounded-lg border border-border bg-muted/50 p-4">
                    <h4 className="mb-3 text-body-sm font-bold">מצב ההורים</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <InfoTag
                        label="סטטוס"
                        value={parentsStatusToHebrew(
                          publicStudent.parents_info.status,
                        )}
                      />
                      {publicStudent.parents_info.holding && (
                        <InfoTag
                          label="מי מגדל"
                          value={
                            publicStudent.parents_info.holding === "mother"
                              ? "האם"
                              : publicStudent.parents_info.holding === "father"
                                ? "האב"
                                : "שניהם"
                          }
                        />
                      )}
                      {publicStudent.parents_info.deadParent === "father" &&
                        publicStudent.parents_info.fatherDeathDate && (
                          <InfoTag
                            label="תאריך פטירת האב"
                            value={publicStudent.parents_info.fatherDeathDate}
                          />
                        )}
                      {publicStudent.parents_info.isMotherRemarried && (
                        <InfoTag
                          label="האם נישאה מחדש"
                          value={
                            publicStudent.parents_info.isMotherRemarried ===
                            "true"
                              ? "כן"
                              : "לא"
                          }
                        />
                      )}
                      {publicStudent.parents_info.isMotherRemarried ===
                        "true" &&
                        publicStudent.parents_info.newHusbandName && (
                          <InfoTag
                            label="שם הבעל החדש"
                            value={publicStudent.parents_info.newHusbandName}
                          />
                        )}
                      {publicStudent.parents_info.isFatherRemarried && (
                        <InfoTag
                          label="האם נישא מחדש"
                          value={
                            publicStudent.parents_info.isFatherRemarried ===
                            "true"
                              ? "כן"
                              : "לא"
                          }
                        />
                      )}
                      {publicStudent.parents_info.isFatherRemarried ===
                        "true" &&
                        publicStudent.parents_info.newWifeName && (
                          <InfoTag
                            label="שם האשה החדשה"
                            value={publicStudent.parents_info.newWifeName}
                          />
                        )}
                    </div>
                  </div>
                )}

                {/* Family Info */}
                {publicStudent.family_info && (
                  <div className="rounded-lg border border-border bg-muted/50 p-4">
                    <h4 className="mb-3 text-body-sm font-bold">
                      פרטים נוספים
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                      {publicStudent.family_info.numberOfChildren && (
                        <InfoTag
                          label="מספר ילדים במשפחה"
                          value={publicStudent.family_info.numberOfChildren}
                        />
                      )}
                      {publicStudent.family_info.currentChildPlace && (
                        <InfoTag
                          label="מיקום במשפחה"
                          value={publicStudent.family_info.currentChildPlace}
                        />
                      )}
                      {publicStudent.family_info.about && (
                        <InfoTag
                          label="על המשפחה"
                          value={publicStudent.family_info.about}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Mechutanim */}
                {publicStudent.family_info?.mechutanim &&
                  publicStudent.family_info.mechutanim.length > 0 && (
                    <div>
                      <h4 className="mb-3 flex items-center gap-2 text-body-sm font-bold">
                        <Heart size={16} /> מחותנים
                      </h4>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {publicStudent.family_info.mechutanim.map(
                          (
                            m: {
                              firstName?: string;
                              lastName?: string;
                              city?: string;
                            },
                            idx: number,
                          ) => (
                            <div
                              key={idx}
                              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                            >
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-caption font-bold">
                                {idx + 1}
                              </div>
                              <div>
                                <p className="text-body-sm font-bold">
                                  {m.firstName} {m.lastName}
                                </p>
                                {m.city && (
                                  <p className="text-caption text-muted-foreground">
                                    {m.city}
                                  </p>
                                )}
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}
              </div>
            </Section>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Education */}
            {publicStudent.education_history &&
              publicStudent.education_history.length > 0 && (
                <Section title="לימודים" icon={GraduationCap}>
                  <div>
                    {publicStudent.education_history.map(
                      (
                        edu: {
                          name?: string;
                          institution_type?: string;
                          community?: string;
                          city?: string;
                        },
                        idx: number,
                      ) => (
                        <div
                          key={idx}
                          className="relative border-r-2 border-border py-2 pr-4"
                        >
                          <div className="absolute top-2 -right-[5px] h-2 w-2 rounded-full bg-primary"></div>
                          <p className="text-body-sm font-bold">{edu.name}</p>
                          <div className="flex flex-wrap gap-1 text-caption text-muted-foreground">
                            {edu.institution_type && (
                              <span>{eduToHebrew(edu.institution_type)}</span>
                            )}
                            {edu.community && (
                              <>
                                {edu.institution_type && <span>|</span>}
                                <span>{edu.community}</span>
                              </>
                            )}
                            {edu.city && (
                              <>
                                {(edu.institution_type || edu.community) && (
                                  <span>|</span>
                                )}
                                <span>{edu.city}</span>
                              </>
                            )}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </Section>
              )}

            {publicStudent.employment_history &&
              publicStudent.employment_history.length > 0 && (
                <Section title="תעסוקה" icon={Briefcase}>
                  <div className="space-y-3">
                    {publicStudent.employment_history.map(
                      (
                        job: {
                          category?: string;
                          role?: string;
                          location?: string;
                          description?: string;
                        },
                        idx: number,
                      ) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-border bg-muted/50 p-3"
                        >
                          {job.category && (
                            <p className="mb-1 text-caption font-bold text-muted-foreground uppercase">
                              {employmentCategoryToHebrew(job.category)}
                            </p>
                          )}
                          {job.role && (
                            <p className="text-body-sm font-bold">{job.role}</p>
                          )}
                          {job.location && (
                            <p className="text-caption text-muted-foreground">
                              {job.location}
                            </p>
                          )}
                          {job.description && (
                            <p className="mt-1 text-caption text-muted-foreground">
                              {job.description}
                            </p>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                </Section>
              )}
          </div>
        </div>
      </div>
    );
  }

  // תמונה של בת נחשפת רק למנהל מערכת — לא לשדכן ולא לבעלת הכרטיס.
  // בהמשך יתווסף כאן גם "משתמש מורשה"
  // כפיצ'ר נפרד — נקודת ההרחבה היחידה היא הביטוי הזה.
  const canViewFemalePhoto = isAdmin;
  const photoPrivate = student.gender === "female" && !canViewFemalePhoto;

  // מי רואה את סעיף המחמאות וההערות בכלל: שדכן/מנהל/איש צוות. RLS הוא
  // האכיפה האמיתית (מי רואה אילו הערות ספציפיות) - זה רק שער תצוגה.
  const canAccessNotes = isShadchan || hasRole(user, "staff");
  const notes = canAccessNotes ? await loadStudentNotes(student.id) : [];
  // Section/InfoTag/IconComponent הוגדרו ב-module scope למעלה (משותפים עם
  // הענף הציבורי) - ראה ההערה שם.

  const genderLabel =
    student.gender === "male"
      ? "זכר"
      : student.gender === "female"
        ? "נקבה"
        : null;
  const shidduchimLabel =
    student.in_shidduchim === true
      ? "כן — מיועד לשידוכים"
      : student.in_shidduchim === false
        ? "לא"
        : null;

  const hasMedicalIssue =
    student.medical_records &&
    (student.medical_records.status === "littleProblem" ||
      student.medical_records.status === "hugeProblem");

  return (
    <div className="min-h-screen space-y-6 text-right">
      {/* Back */}
      <Link
        href="/app/students"
        className="inline-flex items-center gap-1 text-body-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronRight className="h-4 w-4" />
        חזרה לרשימה
      </Link>

      {/* Hero */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/* Photo */}
        {student.image_url && (
          <div className="shrink-0">
            {photoPrivate ? (
              <div className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-full border bg-muted sm:h-24 sm:w-24">
                <Lock className="h-6 w-6 text-muted-foreground" />
                <span className="text-caption text-muted-foreground">חסוי</span>
              </div>
            ) : (
              <StudentPhoto
                src={student.image_url}
                alt={`${student.first_name} ${student.last_name}`}
              />
            )}
          </div>
        )}
        {!student.image_url && (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border bg-muted sm:h-24 sm:w-24">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="text-heading! leading-tight! font-bold!">
            {student.first_name} {student.last_name}
          </h1>
          <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-body-sm text-muted-foreground">
            {genderLabel && <span>{genderLabel}</span>}
            {student.birth_date && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>גיל {calculateAge(student.birth_date)}</span>
              </>
            )}
            {student.personal_status && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>
                  {personalStatusToHebrew(
                    student.personal_status,
                    student.gender,
                  )}
                </span>
              </>
            )}
            {student.city && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>{student.city}</span>
              </>
            )}
            {student.height && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>{student.height} ס"מ</span>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {student.cv_url && (
            <Button asChild variant="outline" size="sm">
              <Link
                href={student.cv_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileText className="h-4 w-4" />
                קו"ח
              </Link>
            </Button>
          )}
          <ShareButton
            studentId={student.id}
            studentName={`${student.first_name} ${student.last_name}`}
          />
          {isShadchan && <MessageButton authorId={student.user_id} />}
          {isShadchan && (
            <StatusUpdateButton
              studentId={student.id}
              currentStatus={student.personal_status as any}
              gender={student.gender as any}
            />
          )}
          {isAdmin && (
            <DeleteStudentButton
              variant="button"
              studentId={student.id}
              studentName={`${student.first_name} ${student.last_name}`}
              redirectTo="/app/students"
            />
          )}
        </div>
      </div>

      {/* Personal details — full width */}
      <Section title="פרטים אישיים" icon={User}>
        {student.about && (
          <p className="leading-relaxed text-muted-foreground">
            {student.about}
          </p>
        )}
        <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4 sm:grid-cols-3 lg:grid-cols-4">
          {genderLabel && <InfoTag label="מגדר" value={genderLabel} />}
          {shidduchimLabel && (
            <InfoTag label="מיועד לשידוכים" value={shidduchimLabel} />
          )}
          <InfoTag label="עיר" value={student.city} />
          <InfoTag label="רחוב" value={student.street} />
          <InfoTag label="מספר בית" value={student.house} />
          <InfoTag label="ארץ" value={student.country} />
          <InfoTag
            label="גיל"
            value={
              student.birth_date
                ? `${calculateAge(student.birth_date)} שנים`
                : null
            }
          />
          <InfoTag label="תעודת זהות" value={student.identity_number} />
          <InfoTag
            label="סטטוס אישי"
            value={
              student.personal_status
                ? personalStatusToHebrew(
                    student.personal_status,
                    student.gender,
                  )
                : null
            }
          />
          {student.height && (
            <InfoTag label="גובה" value={`${student.height} ס"מ`} />
          )}
          {student.community && (
            <InfoTag label="קהילה" value={student.community} />
          )}
          {student.shtible && <InfoTag label="שטיבל" value={student.shtible} />}
          {student.cellphone_type && (
            <InfoTag
              label="סוג מכשיר"
              value={cellphoneTypeToHebrew(student.cellphone_type)}
            />
          )}
          {student.phone && (
            <div className="flex flex-col">
              <span className="text-caption font-medium text-muted-foreground">
                טלפון
              </span>
              <a
                href={`tel:${student.phone}`}
                className="flex items-center gap-1 text-body-sm font-semibold text-primary hover:underline"
              >
                <Phone size={12} /> {student.phone}
              </a>
            </div>
          )}
          {student.plan_for_life && (
            <InfoTag
              label="תכנון לחיים"
              value={planForLifeToHebrew(student.plan_for_life)}
            />
          )}
          {student.head_cover_type && (
            <InfoTag
              label="סוג כיסוי ראש"
              value={headCoverTypeToHebrew(student.head_cover_type)}
            />
          )}
        </div>
      </Section>

      {/* Notes/endorsements — full width, visible only to shadchan/admin/staff */}
      {canAccessNotes && (
        <Section title="מחמאות והערות" icon={MessageSquareText}>
          <StudentNotes
            studentId={student.id}
            canWrite={canAccessNotes}
            initialNotes={notes}
          />
        </Section>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Main Column */}
        <div className="space-y-6 lg:col-span-3">
          {/* Family Background */}
          <Section title="רקע משפחתי" icon={Users}>
            <div className="space-y-6">
              {/* Parents */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Father */}
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="mb-2 text-caption font-bold text-muted-foreground uppercase">
                    אבא
                  </p>
                  <p className="font-bold">
                    {student.parents_info?.father?.self?.prefix || ""}{" "}
                    {student.parents_info?.father?.self?.name || ""}{" "}
                    {student.parents_info?.father?.self?.suffix || ""}
                  </p>
                  {student.parents_info?.father?.job && (
                    <p className="mt-1 text-body-sm text-muted-foreground italic">
                      {student.parents_info.father.job}
                    </p>
                  )}
                  {student.parents_info?.father?.phone && (
                    <a
                      href={`tel:${student.parents_info.father.phone}`}
                      className="mt-2 flex items-center gap-1 text-caption text-muted-foreground hover:text-primary"
                    >
                      <Phone size={12} /> {student.parents_info.father.phone}
                    </a>
                  )}
                  {student.parents_info?.father?.email && (
                    <a
                      href={`mailto:${student.parents_info.father.email}`}
                      className="mt-1 flex items-center gap-1 text-caption text-muted-foreground hover:text-primary"
                    >
                      <Mail size={12} /> {student.parents_info.father.email}
                    </a>
                  )}
                  {/* Grandfather */}
                  {student.parents_info?.father?.grandFather && (
                    <div className="mt-3 border-t border-border pt-3">
                      <p className="text-caption text-muted-foreground">
                        אביו:
                      </p>
                      <p className="text-body-sm">
                        {student.parents_info.father.grandFather.prefix || ""}{" "}
                        {student.parents_info.father.grandFather.name || ""}{" "}
                        {student.parents_info.father.grandFather.suffix || ""}
                      </p>
                    </div>
                  )}
                  {/* Grandmother */}
                  {student.parents_info?.father?.grandMother && (
                    <div className="mt-2">
                      <p className="text-caption text-muted-foreground">אמו:</p>
                      <p className="text-body-sm">
                        {student.parents_info.father.grandMother.prefix || ""}{" "}
                        {student.parents_info.father.grandMother.name || ""}{" "}
                        {student.parents_info.father.grandMother.suffix || ""}
                      </p>
                    </div>
                  )}
                </div>

                {/* Mother */}
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="mb-2 text-caption font-bold text-muted-foreground uppercase">
                    אמא
                  </p>
                  <p className="font-bold">
                    {student.parents_info?.mother?.self?.prefix || ""}{" "}
                    {student.parents_info?.mother?.self?.name || ""}{" "}
                    {student.parents_info?.mother?.self?.suffix || ""}
                    {student.parents_info?.mother?.maidenName && (
                      <span className="text-body-sm font-normal text-muted-foreground">
                        {" "}
                        | לבית {student.parents_info.mother.maidenName}
                      </span>
                    )}
                  </p>
                  {student.parents_info?.mother?.job && (
                    <p className="mt-1 text-body-sm text-muted-foreground">
                      {student.parents_info.mother.job}
                    </p>
                  )}
                  {student.parents_info?.mother?.phone && (
                    <a
                      href={`tel:${student.parents_info.mother.phone}`}
                      className="mt-2 flex items-center gap-1 text-caption text-muted-foreground hover:text-primary"
                    >
                      <Phone size={12} /> {student.parents_info.mother.phone}
                    </a>
                  )}
                  {student.parents_info?.mother?.email && (
                    <a
                      href={`mailto:${student.parents_info.mother.email}`}
                      className="mt-1 flex items-center gap-1 text-caption text-muted-foreground hover:text-primary"
                    >
                      <Mail size={12} /> {student.parents_info.mother.email}
                    </a>
                  )}
                  {student.parents_info?.deadParent === "mother" &&
                    student.parents_info?.motherDeathDate && (
                      <p className="mt-2 text-caption text-destructive">
                        נפטרה ב-
                        {jewishDateHebrew(student.parents_info.motherDeathDate)}
                      </p>
                    )}
                  {/* Grandfather */}
                  {student.parents_info?.mother?.grandFather && (
                    <div className="mt-3 border-t border-border pt-3">
                      <p className="text-caption text-muted-foreground">
                        אביה:
                      </p>
                      <p className="text-body-sm">
                        {student.parents_info.mother.grandFather.prefix || ""}{" "}
                        {student.parents_info.mother.grandFather.name || ""}{" "}
                        {student.parents_info.mother.grandFather.suffix || ""}
                      </p>
                    </div>
                  )}
                  {/* Grandmother */}
                  {student.parents_info?.mother?.grandMother && (
                    <div className="mt-2">
                      <p className="text-caption text-muted-foreground">
                        אימה:
                      </p>
                      <p className="text-body-sm">
                        {student.parents_info.mother.grandMother.prefix || ""}{" "}
                        {student.parents_info.mother.grandMother.name || ""}{" "}
                        {student.parents_info.mother.grandMother.suffix || ""}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Parents Status */}
              {student.parents_info?.status && (
                <div className="rounded-lg border border-border bg-muted/50 p-4">
                  <h4 className="mb-3 text-body-sm font-bold">מצב ההורים</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <InfoTag
                      label="סטטוס"
                      value={parentsStatusToHebrew(student.parents_info.status)}
                    />
                    {student.parents_info.holding && (
                      <InfoTag
                        label="מי מגדל"
                        value={
                          student.parents_info.holding === "mother"
                            ? "האם"
                            : student.parents_info.holding === "father"
                              ? "האב"
                              : "שניהם"
                        }
                      />
                    )}
                    {student.parents_info.deadParent === "father" &&
                      student.parents_info.fatherDeathDate && (
                        <InfoTag
                          label="תאריך פטירת האב"
                          value={student.parents_info.fatherDeathDate}
                        />
                      )}
                    {student.parents_info.isMotherRemarried && (
                      <InfoTag
                        label="האם נישאה מחדש"
                        value={
                          student.parents_info.isMotherRemarried === "true"
                            ? "כן"
                            : "לא"
                        }
                      />
                    )}
                    {student.parents_info.isMotherRemarried === "true" &&
                      student.parents_info.newHusbandName && (
                        <InfoTag
                          label="שם הבעל החדש"
                          value={student.parents_info.newHusbandName}
                        />
                      )}
                    {student.parents_info.isFatherRemarried && (
                      <InfoTag
                        label="האם נישא מחדש"
                        value={
                          student.parents_info.isFatherRemarried === "true"
                            ? "כן"
                            : "לא"
                        }
                      />
                    )}
                    {student.parents_info.isFatherRemarried === "true" &&
                      student.parents_info.newWifeName && (
                        <InfoTag
                          label="שם האשה החדשה"
                          value={student.parents_info.newWifeName}
                        />
                      )}
                  </div>
                </div>
              )}

              {/* Family Info */}
              {student.family_info && (
                <div className="rounded-lg border border-border bg-muted/50 p-4">
                  <h4 className="mb-3 text-body-sm font-bold">פרטים נוספים</h4>
                  <div className="grid grid-cols-3 gap-4">
                    {student.family_info.numberOfChildren && (
                      <InfoTag
                        label="מספר ילדים במשפחה"
                        value={student.family_info.numberOfChildren}
                      />
                    )}
                    {student.family_info.currentChildPlace && (
                      <InfoTag
                        label="מיקום במשפחה"
                        value={student.family_info.currentChildPlace}
                      />
                    )}
                    {student.family_info.about && (
                      <InfoTag
                        label="על המשפחה"
                        value={student.family_info.about}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Mechutanim */}
              {student.family_info?.mechutanim &&
                student.family_info.mechutanim.length > 0 && (
                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-body-sm font-bold">
                      <Heart size={16} /> מחותנים
                    </h4>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {student.family_info.mechutanim.map(
                        (
                          m: {
                            firstName?: string;
                            lastName?: string;
                            city?: string;
                          },
                          idx: number,
                        ) => (
                          <div
                            key={idx}
                            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-caption font-bold">
                              {idx + 1}
                            </div>
                            <div>
                              <p className="text-body-sm font-bold">
                                {m.firstName} {m.lastName}
                              </p>
                              {m.city && (
                                <p className="text-caption text-muted-foreground">
                                  {m.city}
                                </p>
                              )}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}
            </div>
          </Section>

          {/* Previous Partners */}
          {student.previous_partners &&
            student.previous_partners.length > 0 && (
              <Section title="נישואין קודמים" icon={Calendar}>
                <div className="space-y-4">
                  {student.previous_partners.map(
                    (
                      p: {
                        full_name?: string;
                        separation_type?: string;
                        marriage_date?: string;
                        divorce_date?: string;
                        death_date?: string;
                        children_number?: number;
                        divorce_details?: {
                          reason?: string;
                          rabbiName?: string;
                          rabbiPhone?: string;
                        };
                      },
                      idx: number,
                    ) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-border bg-muted/30 p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="font-bold">{p.full_name}</p>
                            {p.marriage_date && (
                              <p className="text-caption text-muted-foreground">
                                נישאו: {p.marriage_date}
                              </p>
                            )}
                            {p.separation_type === "divorce" &&
                              p.divorce_date && (
                                <p className="text-caption text-muted-foreground">
                                  גירושין: {p.divorce_date}
                                </p>
                              )}
                            {p.separation_type === "death" && p.death_date && (
                              <p className="text-caption text-muted-foreground">
                                נפטר/ה ב: {jewishDateHebrew(p.death_date)}
                              </p>
                            )}
                            {p.divorce_details?.reason && (
                              <p className="mt-2 text-body-sm">
                                סיבת הגירושין: {p.divorce_details.reason}
                              </p>
                            )}
                            {p.divorce_details?.rabbiName && (
                              <p className="text-caption text-muted-foreground">
                                רב מלווה: {p.divorce_details.rabbiName}
                                {p.divorce_details.rabbiPhone && (
                                  <span>
                                    {" "}
                                    -{" "}
                                    <a
                                      href={`tel:${p.divorce_details.rabbiPhone}`}
                                      className="hover:text-primary"
                                    >
                                      {p.divorce_details.rabbiPhone}
                                    </a>
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                          {p.children_number ? (
                            <div className="text-left">
                              <span className="rounded-lg border border-border bg-card px-2 py-1 text-caption font-bold">
                                {p.children_number} ילדים
                              </span>
                            </div>
                          ) : (
                            <div className="text-left">
                              <span className="rounded-lg border border-border bg-card px-2 py-1 text-caption font-bold">
                                אין ילדים
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </Section>
            )}

          {/* Partner Preferences */}
          {student.partner_preferences && (
            <Section
              title={
                student.gender === "male" ? "מה אני מחפש?" : "מה אני מחפשת"
              }
              icon={Star}
            >
              <div className="space-y-4">
                {student.partner_preferences.additional_information && (
                  <div className="rounded-lg border-r-4 border-primary bg-muted/50 p-4">
                    <p className="font-medium text-foreground italic">
                      "{student.partner_preferences.additional_information}"
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  {student.partner_preferences.age_min &&
                    student.partner_preferences.age_max && (
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-caption text-muted-foreground">
                          טווח גילאים
                        </p>
                        <p className="text-body-sm font-bold">
                          {student.partner_preferences.age_min} -{" "}
                          {student.partner_preferences.age_max}
                        </p>
                      </div>
                    )}
                  {student.partner_preferences.work_status && (
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-caption text-muted-foreground">
                        סטטוס תעסוקתי מבוקש
                      </p>
                      <p className="text-body-sm font-bold">
                        {workStatusToHebrew(
                          student.partner_preferences.work_status,
                        )}
                      </p>
                    </div>
                  )}
                  {student.partner_preferences.head_cover_type && (
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-caption text-muted-foreground">
                        סוג כיסוי ראש רצוי
                      </p>
                      <p className="text-body-sm font-bold">
                        {headCoverTypeToHebrew(
                          student.partner_preferences.head_cover_type,
                        )}
                      </p>
                    </div>
                  )}
                  {student.partner_preferences.plan_for_life && (
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-caption text-muted-foreground">
                        תכנון לחיים
                      </p>
                      <p className="text-body-sm font-bold">
                        {planForLifeToHebrew(
                          student.partner_preferences.plan_for_life,
                        )}
                      </p>
                    </div>
                  )}
                  {student.partner_preferences.cellphone_type && (
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-caption text-muted-foreground">
                        סוג טלפון מקובל
                      </p>
                      <p className="text-body-sm font-bold">
                        {cellphoneTypeToHebrew(
                          student.partner_preferences.cellphone_type,
                        )}
                      </p>
                    </div>
                  )}
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="mb-2 text-caption text-muted-foreground">
                    ארץ / מדינות מועדפות
                  </p>
                  {!student.partner_preferences.preferred_countries ||
                  student.partner_preferences.preferred_countries.length ===
                    0 ? (
                    <p className="text-body-sm font-bold">
                      ללא העדפה — כל הארצות
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {student.partner_preferences.preferred_countries.map(
                        (country: string, idx: number) => (
                          <Badge key={idx} variant="outline">
                            {country}
                          </Badge>
                        ),
                      )}
                    </div>
                  )}
                </div>
                {student.partner_preferences.about_partner && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="mb-1 text-caption text-muted-foreground">
                      אופי המבוקש
                    </p>
                    <p className="text-body-sm">
                      {student.partner_preferences.about_partner}
                    </p>
                  </div>
                )}
              </div>
            </Section>
          )}
        </div>

        {/* Right Column - Sidebar Info */}
        <div className="space-y-6">
          {/* Education */}
          {student.education_history &&
            student.education_history.length > 0 && (
              <Section title="לימודים" icon={GraduationCap}>
                <div>
                  {student.education_history.map(
                    (
                      edu: {
                        name?: string;
                        institution_type?: string;
                        community?: string;
                        city?: string;
                      },
                      idx: number,
                    ) => (
                      <div
                        key={idx}
                        className="relative border-r-2 border-border py-2 pr-4"
                      >
                        <div className="absolute top-2 -right-[5px] h-2 w-2 rounded-full bg-primary"></div>
                        <p className="text-body-sm font-bold">{edu.name}</p>
                        <div className="flex flex-wrap gap-1 text-caption text-muted-foreground">
                          {edu.institution_type && (
                            <span>{eduToHebrew(edu.institution_type)}</span>
                          )}
                          {edu.community && (
                            <>
                              {edu.institution_type && <span>|</span>}
                              <span>{edu.community}</span>
                            </>
                          )}
                          {edu.city && (
                            <>
                              {(edu.institution_type || edu.community) && (
                                <span>|</span>
                              )}
                              <span>{edu.city}</span>
                            </>
                          )}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </Section>
            )}

          {/* Employment */}
          {student.employment_history &&
            student.employment_history.length > 0 && (
              <Section title="תעסוקה" icon={Briefcase}>
                <div className="space-y-3">
                  {student.employment_history.map(
                    (
                      job: {
                        category?: string;
                        role?: string;
                        location?: string;
                        description?: string;
                      },
                      idx: number,
                    ) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-border bg-muted/50 p-3"
                      >
                        {job.category && (
                          <p className="mb-1 text-caption font-bold text-muted-foreground uppercase">
                            {employmentCategoryToHebrew(job.category)}
                          </p>
                        )}
                        {job.role && (
                          <p className="text-body-sm font-bold">{job.role}</p>
                        )}
                        {job.location && (
                          <p className="text-caption text-muted-foreground">
                            {job.location}
                          </p>
                        )}
                        {job.description && (
                          <p className="mt-1 text-caption text-muted-foreground">
                            {job.description}
                          </p>
                        )}
                      </div>
                    ),
                  )}
                </div>
              </Section>
            )}

          {/* References */}
          {student.references && student.references.length > 0 && (
            <Section title="ממליצים" icon={Info}>
              <div className="space-y-3">
                {student.references.map(
                  (
                    ref: {
                      reference_type?: string;
                      name?: string;
                      phone?: string;
                      email?: string;
                    },
                    idx: number,
                  ) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/50"
                    >
                      <p className="mb-1 text-caption font-bold text-primary">
                        {ref.reference_type &&
                          referenceTypeToHebrew(ref.reference_type)}
                      </p>
                      <p className="text-body-sm font-bold">{ref.name}</p>
                      {ref.phone && (
                        <a
                          href={`tel:${ref.phone}`}
                          className="mt-1 flex items-center gap-1 text-caption text-muted-foreground hover:text-primary"
                        >
                          <Phone size={12} /> {ref.phone}
                        </a>
                      )}
                      {ref.email && (
                        <a
                          href={`mailto:${ref.email}`}
                          className="mt-1 flex items-center gap-1 text-caption text-muted-foreground hover:text-primary"
                        >
                          <Mail size={12} /> {ref.email}
                        </a>
                      )}
                    </div>
                  ),
                )}
              </div>
            </Section>
          )}

          {/* Medical */}
          <Section title="הצהרה רפואית" icon={Stethoscope}>
            <div
              className={cn(
                "rounded-lg p-3",
                hasMedicalIssue
                  ? "border border-destructive/40 bg-destructive/10"
                  : "bg-muted/40",
              )}
            >
              {!hasMedicalIssue ? (
                <p className="text-caption leading-relaxed text-foreground">
                  <strong>מצב בריאותי כללי:</strong>{" "}
                  {student.medical_records?.status === "good"
                    ? medicalStatusToHebrew("good")
                    : "תקין — ללא פירוט על בעיה רפואית (כפי שנמסר במילוי)"}
                </p>
              ) : (
                <>
                  <p className="text-caption leading-relaxed text-foreground">
                    צוין שיש נושא רפואי (
                    {medicalStatusToHebrew(student.medical_records.status)}):
                  </p>
                  {student.medical_records.details && (
                    <blockquote className="mt-1 mb-2 block rounded-sm border-s-2 border-destructive/30 bg-white/25 ps-2 text-caption leading-relaxed">
                      {student.medical_records.details}
                    </blockquote>
                  )}
                  {student.medical_records.exposure_level && (
                    <p className="mb-2 text-caption text-muted-foreground">
                      רמת חשיפה:{" "}
                      {exposureLevelToHebrew(
                        student.medical_records.exposure_level,
                      )}
                    </p>
                  )}
                  {student.medical_records.related_issue_preference && (
                    <p className="text-caption text-muted-foreground">
                      העדפה לשידוך:{" "}
                      {relatedIssuePreferenceToHebrew(
                        student.medical_records.related_issue_preference,
                      )}
                    </p>
                  )}
                  {student.medical_records.contact_info && (
                    <div className="mt-3 border-t border-border pt-3">
                      <p className="mb-1 text-caption font-bold text-muted-foreground">
                        יצירת קשר למידע נוסף:
                      </p>
                      {student.medical_records.contact_info.type ===
                        "parents" && <p className="text-caption">ההורים</p>}
                      {student.medical_records.contact_info.type === "other" &&
                        student.medical_records.contact_info.contacts &&
                        student.medical_records.contact_info.contacts.length >
                          0 && (
                          <div className="space-y-1">
                            {student.medical_records.contact_info.contacts.map(
                              (
                                contact: {
                                  name?: string;
                                  phone?: string;
                                  email?: string;
                                },
                                idx: number,
                              ) => (
                                <div key={idx} className="text-caption">
                                  <p className="font-bold">{contact.name}</p>
                                  {contact.phone && (
                                    <a
                                      href={`tel:${contact.phone}`}
                                      className="hover:text-primary"
                                    >
                                      {contact.phone}
                                    </a>
                                  )}
                                  {contact.email && (
                                    <a
                                      href={`mailto:${contact.email}`}
                                      className="block hover:text-primary"
                                    >
                                      {contact.email}
                                    </a>
                                  )}
                                </div>
                              ),
                            )}
                          </div>
                        )}
                    </div>
                  )}
                  {student.medical_records.documents &&
                    student.medical_records.documents.length > 0 && (
                      <div className="mt-3 border-t border-border pt-3">
                        <p className="mb-2 text-caption font-bold text-muted-foreground">
                          מסמכים רפואיים:
                        </p>
                        <div className="space-y-1">
                          {student.medical_records.documents.map(
                            (doc: string, idx: number) => (
                              <a
                                key={idx}
                                href={doc}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-caption text-primary hover:underline"
                              >
                                <FileText size={12} className="inline" /> מסמך{" "}
                                {idx + 1}
                              </a>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                </>
              )}
            </div>
          </Section>

          {/* Author Info */}
          {student.author_info && (
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="mb-1 text-caption font-bold tracking-widest text-muted-foreground uppercase">
                הקו״ח מולאו ע"י
              </p>
              <p className="text-body-sm font-bold">
                {student.author_info.name}
              </p>
              {student.author_info.phone && (
                <a
                  href={`tel:${student.author_info.phone}`}
                  className="mt-1 flex items-center gap-1 text-caption text-muted-foreground hover:text-primary"
                >
                  <Phone size={12} /> {student.author_info.phone}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
