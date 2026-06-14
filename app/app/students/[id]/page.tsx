import { Box } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import calculateAge from "@/lib/calculateAge";
import { createClient } from "@/lib/supabase/server";
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
} from "lucide-react";
import Link from "next/link";
import ShareButton from "./share-button";
import MessageButton from "./message-button";
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
} from "@/lib/student-profile-labels";
import { unstable_noStore as noStore } from "next/cache";
import { cn } from "@/lib/utils";

export default async function StudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  noStore();
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isShadchan =
    user?.user_metadata?.role === "shadchan" ||
    user?.user_metadata?.role === "admin";

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="space-y-2 text-center">
          <p className="text-destructive font-semibold">שגיאה בטעינת הפרופיל</p>
          <p className="text-muted-foreground text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  const student = data;
  if (!student) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="space-y-2 text-center">
          <p className="text-foreground font-semibold">מיועד לא נמצא</p>
          <p className="text-muted-foreground text-sm">
            הרשומה שחיפשת אינה קיימת במערכת
          </p>
        </div>
      </div>
    );
  }

  type IconComponent = React.ComponentType<{
    size?: number;
    className?: string;
  }>;

  const Section = ({
    title,
    icon: Icon,
    children,
  }: {
    title: string;
    icon: IconComponent;
    children: React.ReactNode;
  }) => (
    <Box className="space-y-4">
      <div className="border-border flex items-center gap-3 border-b pb-3">
        <div className="bg-muted rounded-lg p-2">
          <Icon size={20} className="text-primary" />
        </div>
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      {children}
    </Box>
  );

  const InfoTag = ({
    label,
    value,
  }: {
    label: string;
    value: string | number | null | undefined;
  }) => (
    <div className="flex flex-col">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <span className="text-foreground text-sm font-semibold">
        {value || "---"}
      </span>
    </div>
  );

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
      {/* Header */}
      {/* <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-center">
        <h1>
          {student.first_name} {student.last_name}
        </h1>
      </div> */}

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Left Column - Main Details */}
        <div className="space-y-6 lg:col-span-3">
          {/* Basic Information */}
          <Section title="פרטים אישיים" icon={User}>
            <div className="flex justify-between gap-2">
              <h1>
                {student.first_name} {student.last_name}
              </h1>
              <div className="flex gap-2">
                <ShareButton />
                {isShadchan && <MessageButton authorId={student.user_id} />}
              </div>
            </div>

            {student.about && (
              <p className="text-muted-foreground leading-relaxed">
                {student.about}
              </p>
            )}
            <div className="bg-muted/50 grid grid-cols-2 gap-4 rounded-lg p-4 sm:grid-cols-3 lg:grid-cols-4">
              {genderLabel && (
                <InfoTag label="מגדר" value={genderLabel} />
              )}
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
                    ? personalStatusToHebrew(student.personal_status)
                    : null
                }
              />
              {student.height && (
                <InfoTag label="גובה" value={`${student.height} ס"מ`} />
              )}
              {student.community && (
                <InfoTag label="קהילה" value={student.community} />
              )}
              {student.shtible && (
                <InfoTag label="שטיבל" value={student.shtible} />
              )}
              {student.cellphone_type && (
                <InfoTag
                  label="סוג מכשיר"
                  value={cellphoneTypeToHebrew(student.cellphone_type)}
                />
              )}
              {student.phone && (
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs font-medium">
                    טלפון
                  </span>
                  <a
                    href={`tel:${student.phone}`}
                    className="text-primary flex items-center gap-1 text-sm font-semibold hover:underline"
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

          {/* Family Background */}
          <Section title="רקע משפחתי" icon={Users}>
            <div className="space-y-6">
              {/* Parents */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Father */}
                <div className="border-border bg-muted/30 rounded-lg border p-4">
                  <p className="text-muted-foreground mb-2 text-xs font-bold uppercase">
                    אבא
                  </p>
                  <p className="font-bold">
                    {student.parents_info?.father?.self?.prefix || ""}{" "}
                    {student.parents_info?.father?.self?.name || ""}{" "}
                    {student.parents_info?.father?.self?.suffix || ""}
                  </p>
                  {student.parents_info?.father?.job && (
                    <p className="text-muted-foreground mt-1 text-sm italic">
                      {student.parents_info.father.job}
                    </p>
                  )}
                  {student.parents_info?.father?.phone && (
                    <a
                      href={`tel:${student.parents_info.father.phone}`}
                      className="text-muted-foreground hover:text-primary mt-2 flex items-center gap-1 text-xs"
                    >
                      <Phone size={12} /> {student.parents_info.father.phone}
                    </a>
                  )}
                  {student.parents_info?.father?.email && (
                    <a
                      href={`mailto:${student.parents_info.father.email}`}
                      className="text-muted-foreground hover:text-primary mt-1 flex items-center gap-1 text-xs"
                    >
                      <Mail size={12} /> {student.parents_info.father.email}
                    </a>
                  )}
                  {/* Grandfather */}
                  {student.parents_info?.father?.grandFather && (
                    <div className="border-border mt-3 border-t pt-3">
                      <p className="text-muted-foreground text-xs">אביו:</p>
                      <p className="text-sm">
                        {student.parents_info.father.grandFather.prefix || ""}{" "}
                        {student.parents_info.father.grandFather.name || ""}{" "}
                        {student.parents_info.father.grandFather.suffix || ""}
                      </p>
                    </div>
                  )}
                  {/* Grandmother */}
                  {student.parents_info?.father?.grandMother && (
                    <div className="mt-2">
                      <p className="text-muted-foreground text-xs">אמו:</p>
                      <p className="text-sm">
                        {student.parents_info.father.grandMother.prefix || ""}{" "}
                        {student.parents_info.father.grandMother.name || ""}{" "}
                        {student.parents_info.father.grandMother.suffix || ""}
                      </p>
                    </div>
                  )}
                </div>

                {/* Mother */}
                <div className="border-border bg-muted/30 rounded-lg border p-4">
                  <p className="text-muted-foreground mb-2 text-xs font-bold uppercase">
                    אמא
                  </p>
                  <p className="font-bold">
                    {student.parents_info?.mother?.self?.prefix || ""}{" "}
                    {student.parents_info?.mother?.self?.name || ""}{" "}
                    {student.parents_info?.mother?.self?.suffix || ""}
                    {student.parents_info?.mother?.maidenName && (
                      <span className="text-muted-foreground text-sm font-normal">
                        {" "}
                        | לבית {student.parents_info.mother.maidenName}
                      </span>
                    )}
                  </p>
                  {student.parents_info?.mother?.job && (
                    <p className="text-muted-foreground mt-1 text-sm">
                      {student.parents_info.mother.job}
                    </p>
                  )}
                  {student.parents_info?.mother?.phone && (
                    <a
                      href={`tel:${student.parents_info.mother.phone}`}
                      className="text-muted-foreground hover:text-primary mt-2 flex items-center gap-1 text-xs"
                    >
                      <Phone size={12} /> {student.parents_info.mother.phone}
                    </a>
                  )}
                  {student.parents_info?.mother?.email && (
                    <a
                      href={`mailto:${student.parents_info.mother.email}`}
                      className="text-muted-foreground hover:text-primary mt-1 flex items-center gap-1 text-xs"
                    >
                      <Mail size={12} /> {student.parents_info.mother.email}
                    </a>
                  )}
                  {student.parents_info?.deadParent === "mother" &&
                    student.parents_info?.motherDeathDate && (
                      <p className="text-destructive mt-2 text-xs">
                        נפטרה ב-
                        {jewishDateHebrew(student.parents_info.motherDeathDate)}
                      </p>
                    )}
                  {/* Grandfather */}
                  {student.parents_info?.mother?.grandFather && (
                    <div className="border-border mt-3 border-t pt-3">
                      <p className="text-muted-foreground text-xs">אביה:</p>
                      <p className="text-sm">
                        {student.parents_info.mother.grandFather.prefix || ""}{" "}
                        {student.parents_info.mother.grandFather.name || ""}{" "}
                        {student.parents_info.mother.grandFather.suffix || ""}
                      </p>
                    </div>
                  )}
                  {/* Grandmother */}
                  {student.parents_info?.mother?.grandMother && (
                    <div className="mt-2">
                      <p className="text-muted-foreground text-xs">אימה:</p>
                      <p className="text-sm">
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
                <div className="border-border bg-muted/50 rounded-lg border p-4">
                  <h4 className="mb-3 text-sm font-bold">מצב ההורים</h4>
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
                <div className="border-border bg-muted/50 rounded-lg border p-4">
                  <h4 className="mb-3 text-sm font-bold">פרטים נוספים</h4>
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
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-bold">
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
                            className="border-border bg-card flex items-center gap-3 rounded-lg border p-3"
                          >
                            <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold">
                              {idx + 1}
                            </div>
                            <div>
                              <p className="text-sm font-bold">
                                {m.firstName} {m.lastName}
                              </p>
                              {m.city && (
                                <p className="text-muted-foreground text-xs">
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
                        className="border-border bg-muted/30 rounded-lg border p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="font-bold">{p.full_name}</p>
                            {p.marriage_date && (
                              <p className="text-muted-foreground text-xs">
                                נישאו: {p.marriage_date}
                              </p>
                            )}
                            {p.separation_type === "divorce" &&
                              p.divorce_date && (
                                <p className="text-muted-foreground text-xs">
                                  גירושין: {p.divorce_date}
                                </p>
                              )}
                            {p.separation_type === "death" && p.death_date && (
                              <p className="text-muted-foreground text-xs">
                                נפטר/ה ב: {jewishDateHebrew(p.death_date)}
                              </p>
                            )}
                            {p.divorce_details?.reason && (
                              <p className="mt-2 text-sm">
                                סיבת הגירושין: {p.divorce_details.reason}
                              </p>
                            )}
                            {p.divorce_details?.rabbiName && (
                              <p className="text-muted-foreground text-xs">
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
                              <span className="border-border bg-card rounded-lg border px-2 py-1 text-xs font-bold">
                                {p.children_number} ילדים
                              </span>
                            </div>
                          ) : (
                            <div className="text-left">
                              <span className="border-border bg-card rounded-lg border px-2 py-1 text-xs font-bold">
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
                  <div className="border-primary bg-muted/50 rounded-lg border-r-4 p-4">
                    <p className="text-foreground font-medium italic">
                      "{student.partner_preferences.additional_information}"
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  {student.partner_preferences.age_min &&
                    student.partner_preferences.age_max && (
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-muted-foreground text-xs">
                          טווח גילאים
                        </p>
                        <p className="text-sm font-bold">
                          {student.partner_preferences.age_min} -{" "}
                          {student.partner_preferences.age_max}
                        </p>
                      </div>
                    )}
                  {student.partner_preferences.work_status && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-muted-foreground text-xs">
                        סטטוס תעסוקתי מבוקש
                      </p>
                      <p className="text-sm font-bold">
                        {workStatusToHebrew(
                          student.partner_preferences.work_status,
                        )}
                      </p>
                    </div>
                  )}
                  {student.partner_preferences.head_cover_type && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-muted-foreground text-xs">
                        סוג כיסוי ראש רצוי
                      </p>
                      <p className="text-sm font-bold">
                        {headCoverTypeToHebrew(
                          student.partner_preferences.head_cover_type,
                        )}
                      </p>
                    </div>
                  )}
                  {student.partner_preferences.plan_for_life && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-muted-foreground text-xs">
                        תכנון לחיים
                      </p>
                      <p className="text-sm font-bold">
                        {planForLifeToHebrew(
                          student.partner_preferences.plan_for_life,
                        )}
                      </p>
                    </div>
                  )}
                  {student.partner_preferences.cellphone_type && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-muted-foreground text-xs">
                        סוג טלפון מקובל
                      </p>
                      <p className="text-sm font-bold">
                        {cellphoneTypeToHebrew(
                          student.partner_preferences.cellphone_type,
                        )}
                      </p>
                    </div>
                  )}
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-muted-foreground mb-2 text-xs">
                    ארץ / מדינות מועדפות
                  </p>
                  {!student.partner_preferences.preferred_countries ||
                  student.partner_preferences.preferred_countries.length ===
                    0 ? (
                    <p className="text-sm font-bold">ללא העדפה — כל הארצות</p>
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
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-muted-foreground mb-1 text-xs">
                      אופי המבוקש
                    </p>
                    <p className="text-sm">
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
                        className="border-border relative border-r-2 py-2 pr-4"
                      >
                        <div className="bg-primary absolute top-2 -right-[5px] h-2 w-2 rounded-full"></div>
                        <p className="text-sm font-bold">{edu.name}</p>
                        <div className="text-muted-foreground flex flex-wrap gap-1 text-xs">
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
                        className="border-border bg-muted/50 rounded-lg border p-3"
                      >
                        {job.category && (
                          <p className="text-muted-foreground mb-1 text-xs font-bold uppercase">
                            {employmentCategoryToHebrew(job.category)}
                          </p>
                        )}
                        {job.role && (
                          <p className="text-sm font-bold">{job.role}</p>
                        )}
                        {job.location && (
                          <p className="text-muted-foreground text-xs">
                            {job.location}
                          </p>
                        )}
                        {job.description && (
                          <p className="text-muted-foreground mt-1 text-xs">
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
                      className="border-border bg-card hover:bg-muted/50 rounded-lg border p-3 transition-colors"
                    >
                      <p className="text-primary mb-1 text-xs font-bold">
                        {ref.reference_type &&
                          referenceTypeToHebrew(ref.reference_type)}
                      </p>
                      <p className="text-sm font-bold">{ref.name}</p>
                      {ref.phone && (
                        <a
                          href={`tel:${ref.phone}`}
                          className="text-muted-foreground hover:text-primary mt-1 flex items-center gap-1 text-xs"
                        >
                          <Phone size={12} /> {ref.phone}
                        </a>
                      )}
                      {ref.email && (
                        <a
                          href={`mailto:${ref.email}`}
                          className="text-muted-foreground hover:text-primary mt-1 flex items-center gap-1 text-xs"
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

          {/* Medical — תמיד מוצג: תקין או פירוט בעיה */}
          <div
            className={cn(
              "rounded-lg border p-4",
              hasMedicalIssue
                ? "border-destructive/50 bg-destructive/10"
                : "border-border bg-muted/30",
            )}
          >
            <div
              className={
                hasMedicalIssue
                  ? "text-destructive mb-2 flex items-center gap-2"
                  : "text-foreground mb-2 flex items-center gap-2"
              }
            >
              <Stethoscope size={18} />
              <h3 className="text-sm font-bold">הצהרה רפואית</h3>
            </div>
            {!hasMedicalIssue ? (
              <p className="text-foreground text-xs leading-relaxed">
                <strong>מצב בריאותי כללי:</strong>{" "}
                {student.medical_records?.status === "good"
                  ? medicalStatusToHebrew("good")
                  : "תקין — ללא פירוט על בעיה רפואית (כפי שנמסר במילוי)"}
              </p>
            ) : (
              <>
                <p className="text-foreground text-xs leading-relaxed">
                  צוין שיש נושא רפואי (
                  {medicalStatusToHebrew(student.medical_records.status)}):
                </p>
                {student.medical_records.details && (
                  <blockquote className="border-destructive/30 mt-1 mb-2 block rounded-sm border-s-2 bg-white/25 ps-2 text-xs leading-relaxed">
                    {student.medical_records.details}
                  </blockquote>
                )}
                {student.medical_records.exposure_level && (
                  <p className="text-muted-foreground mb-2 text-xs">
                    רמת חשיפה:{" "}
                    {exposureLevelToHebrew(
                      student.medical_records.exposure_level,
                    )}
                  </p>
                )}
                {student.medical_records.related_issue_preference && (
                  <p className="text-muted-foreground text-xs">
                    העדפה לשידוך:{" "}
                    {relatedIssuePreferenceToHebrew(
                      student.medical_records.related_issue_preference,
                    )}
                  </p>
                )}
                {student.medical_records.contact_info && (
                  <div className="border-border mt-3 border-t pt-3">
                    <p className="text-muted-foreground mb-1 text-xs font-bold">
                      יצירת קשר למידע נוסף:
                    </p>
                    {student.medical_records.contact_info.type ===
                      "parents" && <p className="text-xs">ההורים</p>}
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
                              <div key={idx} className="text-xs">
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
                                    className="hover:text-primary block"
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
                    <div className="border-border mt-3 border-t pt-3">
                      <p className="text-muted-foreground mb-2 text-xs font-bold">
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
                              className="text-primary block text-xs hover:underline"
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

          {/* Author Info */}
          {student.author_info && (
            <div className="border-border bg-card rounded-lg border p-4 text-center">
              <p className="text-muted-foreground mb-1 text-xs font-bold tracking-widest uppercase">
                הקו״ח מולאו ע"י
              </p>
              <p className="text-sm font-bold">{student.author_info.name}</p>
              {student.author_info.phone && (
                <a
                  href={`tel:${student.author_info.phone}`}
                  className="text-muted-foreground hover:text-primary mt-1 flex items-center justify-center gap-1 text-xs"
                >
                  <Phone size={12} /> {student.author_info.phone}
                </a>
              )}
            </div>
          )}

          {/* CV Link */}
          {student.cv_url && (
            <Button
              asChild
              variant="outline"
              className="border-border bg-card w-full rounded-lg border p-4 text-center"
            >
              <Link
                href={student.cv_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary flex items-center justify-center gap-2 text-sm font-bold"
              >
                <FileText size={16} />
                צפייה בקורות חיים
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
