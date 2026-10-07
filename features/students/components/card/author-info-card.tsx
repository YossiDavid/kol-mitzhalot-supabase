import { Phone } from "lucide-react";

import {
  describeAuthorRelation,
  readAuthorInfo,
} from "@/features/students/lib/author-info";

/**
 * "הקו״ח מולאו ע"י": שם, קשר וטלפון. בכרטיס צד שלישי גם "מכיר/ה היטב"
 * (לשדכנים ולמנהלים) וההסבר מדוע מולא על ידו - הסבר זה מגיע לכאן רק
 * כשהשרת השאיר אותו (מנהל או הממלא עצמו; ראו withoutFillReason).
 */
export function AuthorInfoCard({
  authorInfo,
  cardFor,
  canSeeKnowsWell = false,
}: {
  authorInfo: unknown;
  cardFor?: string | null;
  canSeeKnowsWell?: boolean;
}) {
  const info = readAuthorInfo(authorInfo, cardFor);
  if (!info.name && !info.phone) return null;
  const relation = describeAuthorRelation(info);
  return (
    <div
      className="rounded-lg border border-border bg-card p-4"
      data-testid="author-info-card"
    >
      <p className="mb-1 text-caption font-bold tracking-widest text-muted-foreground uppercase">
        הקו״ח מולאו ע"י
      </p>
      <p className="text-body-sm font-bold">{info.name}</p>
      {relation && (
        <p className="text-caption text-muted-foreground">{relation}</p>
      )}
      {canSeeKnowsWell && info.knowsWell !== null && (
        <p className="text-caption text-muted-foreground">
          מכיר/ה היטב את המועמד/ת: {info.knowsWell ? "כן" : "לא"}
        </p>
      )}
      {info.phone && (
        <a
          href={`tel:${info.phone}`}
          className="mt-1 flex items-center gap-1 text-caption text-muted-foreground hover:text-primary"
        >
          <Phone size={12} /> {info.phone}
        </a>
      )}
      {info.fillReason && (
        <p
          className="mt-2 border-t border-border pt-2 text-caption text-muted-foreground"
          data-testid="author-fill-reason"
        >
          <span className="font-bold">מדוע מולא על ידו: </span>
          {info.fillReason}
        </p>
      )}
    </div>
  );
}
