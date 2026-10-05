import { Info, Mail, Phone } from "lucide-react";

import { referenceTypeToHebrew } from "@/features/students/lib/profile-labels";

import { CardSection } from "./card-section";
import type { ReferenceEntry } from "./types";

/**
 * "ממליצים" - סוג, שם, טלפון ואימייל. מוצג בכל הווריאנטים, גם בציבורי (החלטת
 * הלקוח); בהצעת שידוך הטלפון והאימייל נחתכים ב-select כשההתקשרות סגורה.
 */
export function ReferencesSection({
  references,
}: {
  references: ReferenceEntry[] | null | undefined;
}) {
  if (!references || references.length === 0) return null;
  return (
    <CardSection title="ממליצים" icon={Info}>
      <div className="space-y-3">
        {references.map((ref, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/50"
          >
            <p className="mb-1 text-caption font-bold text-primary">
              {ref.reference_type && referenceTypeToHebrew(ref.reference_type)}
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
        ))}
      </div>
    </CardSection>
  );
}
