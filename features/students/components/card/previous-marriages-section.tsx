import { Calendar } from "lucide-react";

import {
  describeChild,
  formatChildrenCount,
  getChildrenCount,
  parseStoredChildren,
} from "@/features/students/lib/previous-partner-children";
import { jewishDateHebrew } from "@/lib/jewishDatte";

import { CardSection } from "./card-section";
import type { PreviousPartnerEntry } from "./types";

/** "נישואין קודמים" - כולל הילדים מכל נישואין. למשתמש מחובר בלבד */
export function PreviousMarriagesSection({
  partners,
  gender,
}: {
  partners: PreviousPartnerEntry[] | null | undefined;
  gender: string | null | undefined;
}) {
  if (!partners || partners.length === 0) return null;

  return (
    <CardSection title="נישואין קודמים" icon={Calendar}>
      <div className="space-y-4">
        {partners.map((p, idx) => {
          const children = parseStoredChildren(p.children);
          const childrenCount = getChildrenCount(children, p.children_number);
          return (
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
                  {p.separation_type === "divorce" && p.divorce_date && (
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
                <div className="text-end">
                  <span className="rounded-lg border border-border bg-card px-2 py-1 text-caption font-bold whitespace-nowrap">
                    {formatChildrenCount(childrenCount)}
                  </span>
                </div>
              </div>
              {children.length > 0 && (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="text-caption font-bold text-muted-foreground">
                    ילדים מנישואין אלו
                  </p>
                  <ul className="mt-1 space-y-1">
                    {children.map((child, childIdx) => (
                      <li
                        key={childIdx}
                        className="text-body-sm text-foreground"
                      >
                        {describeChild(child, gender)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </CardSection>
  );
}
