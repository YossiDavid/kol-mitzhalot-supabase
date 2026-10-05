import { Mail, Phone } from "lucide-react";

import type { NameWithTitles, ParentInfo } from "./types";

function fullName(value: NameWithTitles | null | undefined) {
  return (
    <>
      {value?.prefix || ""} {value?.name || ""} {value?.suffix || ""}
    </>
  );
}

/** הורה נוסף (סב/סבתא) מתחת לשם ההורה */
function GrandParent({
  label,
  value,
  withDivider,
}: {
  label: string;
  value: NameWithTitles | null | undefined;
  withDivider?: boolean;
}) {
  if (!value) return null;
  return (
    <div className={withDivider ? "mt-3 border-t border-border pt-3" : "mt-2"}>
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className="text-body-sm">{fullName(value)}</p>
    </div>
  );
}

/**
 * כרטיסון הורה ברקע המשפחתי. אב ואם נבדלים רק בתוויות, בשם הנעורים,
 * בהערת הפטירה ובנטייה של שורת העיסוק - ולכן זה רכיב אחד עם props.
 */
export function ParentCard({
  label,
  parent,
  grandFatherLabel,
  grandMotherLabel,
  maidenName,
  jobItalic,
  deathNote,
  isDeceased,
}: {
  label: string;
  parent: ParentInfo | null | undefined;
  grandFatherLabel: string;
  grandMotherLabel: string;
  maidenName?: string | null;
  jobItalic?: boolean;
  deathNote?: React.ReactNode;
  /** הורה שנפטר: ז"ל ליד השם, בלי טלפון, עיסוק ואימייל */
  isDeceased?: boolean;
}) {
  // נתונים ישנים עלולים עדיין להחזיק פרטי קשר של הורה שנפטר: לא מציגים
  // אותם, גם בכרטיס הציבורי
  const job = isDeceased ? null : parent?.job;
  const phone = isDeceased ? null : parent?.phone;
  const email = isDeceased ? null : parent?.email;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <p className="mb-2 text-caption font-bold text-muted-foreground uppercase">
        {label}
      </p>
      <p className="font-bold">
        {fullName(parent?.self)}
        {isDeceased && <span> ז״ל</span>}
        {maidenName && (
          <span className="text-body-sm font-normal text-muted-foreground">
            {" "}
            | לבית {maidenName}
          </span>
        )}
      </p>
      {job && (
        <p
          className={
            jobItalic
              ? "mt-1 text-body-sm text-muted-foreground italic"
              : "mt-1 text-body-sm text-muted-foreground"
          }
        >
          {job}
        </p>
      )}
      {phone && (
        <a
          href={`tel:${phone}`}
          className="mt-2 flex items-center gap-1 text-caption text-muted-foreground hover:text-primary"
        >
          <Phone size={12} /> {phone}
        </a>
      )}
      {email && (
        <a
          href={`mailto:${email}`}
          className="mt-1 flex items-center gap-1 text-caption text-muted-foreground hover:text-primary"
        >
          <Mail size={12} /> {email}
        </a>
      )}
      {deathNote}
      <GrandParent
        label={grandFatherLabel}
        value={parent?.grandFather}
        withDivider
      />
      <GrandParent label={grandMotherLabel} value={parent?.grandMother} />
    </div>
  );
}
