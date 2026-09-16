import { FileText, Stethoscope } from "lucide-react";

import {
  exposureLevelToHebrew,
  medicalStatusToHebrew,
  relatedIssuePreferenceToHebrew,
} from "@/features/students/lib/profile-labels";
import { cn } from "@/lib/utils";

import { CardSection } from "./card-section";

type MedicalContact = { name?: string; phone?: string; email?: string };

type MedicalRecords = {
  status?: string;
  details?: string;
  exposure_level?: string;
  related_issue_preference?: string;
  contact_info?: { type?: string; contacts?: MedicalContact[] } | null;
  documents?: string[] | null;
} | null;

function ContactList({ contacts }: { contacts: MedicalContact[] }) {
  return (
    <div className="space-y-1">
      {contacts.map((contact, idx) => (
        <div key={idx} className="text-caption">
          <p className="font-bold">{contact.name}</p>
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className="hover:text-primary">
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
      ))}
    </div>
  );
}

/**
 * "הצהרה רפואית". המקטע מוצג תמיד למשתמש מחובר - גם כשאין רשומה רפואית,
 * ואז מוצגת שורת "תקין". בענף הציבורי הטבלה לא נשלפת כלל.
 */
export function MedicalSection({ medical }: { medical: MedicalRecords }) {
  const hasMedicalIssue =
    !!medical &&
    (medical.status === "littleProblem" || medical.status === "hugeProblem");

  return (
    <CardSection title="הצהרה רפואית" icon={Stethoscope}>
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
            {medical?.status === "good"
              ? medicalStatusToHebrew("good")
              : "תקין — ללא פירוט על בעיה רפואית (כפי שנמסר במילוי)"}
          </p>
        ) : (
          <>
            <p className="text-caption leading-relaxed text-foreground">
              צוין שיש נושא רפואי ({medicalStatusToHebrew(medical!.status!)}):
            </p>
            {medical!.details && (
              <blockquote className="mt-1 mb-2 block rounded-sm border-s-2 border-destructive/30 bg-white/25 ps-2 text-caption leading-relaxed">
                {medical!.details}
              </blockquote>
            )}
            {medical!.exposure_level && (
              <p className="mb-2 text-caption text-muted-foreground">
                רמת חשיפה: {exposureLevelToHebrew(medical!.exposure_level)}
              </p>
            )}
            {medical!.related_issue_preference && (
              <p className="text-caption text-muted-foreground">
                העדפה לשידוך:{" "}
                {relatedIssuePreferenceToHebrew(
                  medical!.related_issue_preference,
                )}
              </p>
            )}
            {medical!.contact_info && (
              <div className="mt-3 border-t border-border pt-3">
                <p className="mb-1 text-caption font-bold text-muted-foreground">
                  יצירת קשר למידע נוסף:
                </p>
                {medical!.contact_info.type === "parents" && (
                  <p className="text-caption">ההורים</p>
                )}
                {medical!.contact_info.type === "other" &&
                  medical!.contact_info.contacts &&
                  medical!.contact_info.contacts.length > 0 && (
                    <ContactList contacts={medical!.contact_info.contacts} />
                  )}
              </div>
            )}
            {medical!.documents && medical!.documents.length > 0 && (
              <div className="mt-3 border-t border-border pt-3">
                <p className="mb-2 text-caption font-bold text-muted-foreground">
                  מסמכים רפואיים:
                </p>
                <div className="space-y-1">
                  {medical!.documents.map((doc, idx) => (
                    <a
                      key={idx}
                      href={doc}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-caption text-primary hover:underline"
                    >
                      <FileText size={12} className="inline" /> מסמך {idx + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </CardSection>
  );
}
