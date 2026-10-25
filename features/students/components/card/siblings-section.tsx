import Link from "next/link";
import { Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { CardSibling } from "@/features/students/lib/card-siblings";

function relationLabel(sibling: CardSibling): string {
  const isFemale = sibling.gender === "female";
  const base = isFemale ? "אחות" : "אח";
  if (sibling.relativeAge === "older") return `${base} ${isFemale ? "מבוגרת" : "מבוגר"}`;
  if (sibling.relativeAge === "younger") return `${base} ${isFemale ? "צעירה" : "צעיר"}`;
  return base;
}

/**
 * "אחים במערכת": קישור לכרטיסים של אותה משפחה גרעינית, עם סימון אח/אחות
 * מבוגר או צעיר ומצב בשידוכים (שיקול נפוץ בהצעה).
 */
export function SiblingsSection({ siblings }: { siblings: CardSibling[] }) {
  if (siblings.length === 0) return null;
  return (
    <div
      className="rounded-lg border border-border bg-card px-4 py-3"
      data-testid="card-siblings"
    >
      <p className="mb-2 flex items-center gap-2 text-body-sm font-bold">
        <Users className="size-4" aria-hidden />
        אחים במערכת
      </p>
      <ul className="flex flex-wrap gap-2">
        {siblings.map((sibling) => (
          <li key={sibling.id}>
            <Link
              href={`/app/students/${sibling.id}`}
              className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1 text-body-sm hover:bg-muted"
            >
              <span className="font-medium">{sibling.name}</span>
              <span className="text-muted-foreground">{relationLabel(sibling)}</span>
              {sibling.isInShidduchim && (
                <Badge variant="outline">בשידוכים</Badge>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
