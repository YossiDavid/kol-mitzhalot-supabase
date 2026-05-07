import { Box } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import calculateAge from "@/lib/calculateAge";
import {
  SHIDDUCH_STATUS_BADGE_CLASS,
  SHIDDUCH_STATUS_LABELS,
  type ShidduchStatus,
} from "@/lib/shidduch-status";
import { employmentCategoryToHebrew } from "@/lib/student-profile-labels";
import { FileCheck2, Pencil, User } from "lucide-react";
import Link from "next/link";

type StudentLite = {
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  city: string | null;
  cv_url?: string | null;
  parents_info: any;
  education_history?: { name: string | null }[] | null;
  employment_history?:
    | { category: string | null; role: string | null }[]
    | null;
};

type Shiduch = {
  id: string;
  status: ShidduchStatus;
  note_for_groom: string | null;
  note_for_bride: string | null;
  groom: StudentLite | null;
  bride: StudentLite | null;
};

function fullName(student: StudentLite | null, fallback: string) {
  const full =
    `${student?.first_name || ""} ${student?.last_name || ""}`.trim();
  return full || fallback;
}

function getLastInstitution(student: StudentLite | null) {
  const list = student?.education_history || [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const name = list[i]?.name?.trim();
    if (name) return name;
  }
  return "ללא מוסד לימודים";
}

function getOccupation(student: StudentLite | null) {
  const first = student?.employment_history?.[0];
  if (!first) return "ללא עיסוק";
  if (first.role?.trim()) return first.role.trim();
  if (first.category?.trim())
    return employmentCategoryToHebrew(first.category.trim());
  return "ללא עיסוק";
}

function getAge(student: StudentLite | null) {
  if (!student?.birth_date) return "-";
  return String(calculateAge(student.birth_date));
}

function CandidateSection({
  title,
  student,
  parentPrefix,
  note,
}: {
  title: string;
  student: StudentLite | null;
  parentPrefix: "בן ר׳" | "בת ר׳";
  note: string | null;
}) {
  const fallbackParent =
    parentPrefix === "בן ר׳" ? "בן ר׳ לא צוין" : "בת ר׳ לא צוין";
  const parentName = student?.parents_info?.father?.self?.name;

  return (
    <div className="text-center">
      <p className="text-muted-foreground">{title}</p>
      <p className="mt-1 flex items-center justify-center gap-1.5 text-2xl leading-none font-bold md:text-3xl">
        {fullName(student, title.replace("שם ", ""))}
        {student?.cv_url ? (
          <a
            href={student.cv_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-700 hover:text-emerald-800"
            title="פתיחת קובץ קו״ח"
          >
            <FileCheck2 className="size-4 shrink-0 md:size-5" />
          </a>
        ) : (
          <span title="לא הועלה קו״ח">
            <FileCheck2 className="text-muted-foreground/40 size-4 shrink-0 md:size-5" />
          </span>
        )}
      </p>
      <p className="text-muted-foreground text-lg md:text-xl">
        {parentName ? `${parentPrefix} ${parentName}` : fallbackParent}
      </p>
      <p className="text-muted-foreground mt-2 text-base md:text-lg">
        {getAge(student)} | {student?.city || "ללא עיר"} |{" "}
        {getLastInstitution(student)} | {getOccupation(student)}
      </p>
      <p className="mt-3 inline-flex rounded-lg bg-slate-100 px-3 py-1 text-base text-slate-700 md:text-lg">
        {note?.trim() || "ממתינים לעדכון מהשדכן"}
      </p>
    </div>
  );
}

function ActiveShidduchCard({ shiduch }: { shiduch: Shiduch }) {
  return (
    <Box>
      <div className="bg-muted/40 relative flex flex-col gap-2 rounded-2xl border p-4 md:p-5">
        <Button
          asChild
          variant="outline"
          size="icon"
          title="עריכה"
          className="absolute start-4 top-4 z-10"
        >
          <Link href={`/app/shidduchim/${shiduch.id}`}>
            <Pencil />
            <span className="sr-only">עריכה</span>
          </Link>
        </Button>
        <Badge
          variant="outline"
          className={`self-center ${SHIDDUCH_STATUS_BADGE_CLASS[shiduch.status]}`}
        >
          {SHIDDUCH_STATUS_LABELS[shiduch.status]}
        </Badge>
        <CandidateSection
          title="שם המיועד"
          student={shiduch.groom}
          parentPrefix="בן ר׳"
          note={shiduch.note_for_groom}
        />
        <div className="my-4 border-t border-dashed" />
        <CandidateSection
          title="שם המיועדת"
          student={shiduch.bride}
          parentPrefix="בת ר׳"
          note={shiduch.note_for_bride}
        />
      </div>
    </Box>
  );
}

export default function ActiveShidduchim({
  shiduchim,
}: {
  shiduchim: Shiduch[];
}) {
  return (
    <>
      {shiduchim.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shiduchim.map((shiduch) => (
            <ActiveShidduchCard key={shiduch.id} shiduch={shiduch} />
          ))}
        </div>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>עדיין לא שלחת הצעות לשידוכים</EmptyTitle>
            <EmptyDescription>
              זה נראה כמו זמן מצוין להתחיל, לא?
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/app/students">
                <User />
                לרשימת המיועדים
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </>
  );
}
