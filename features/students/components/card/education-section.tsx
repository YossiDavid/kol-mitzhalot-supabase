import { Briefcase, GraduationCap } from "lucide-react";

import {
  eduToHebrew,
  employmentCategoryToHebrew,
} from "@/features/students/lib/profile-labels";

import { CardSection } from "./card-section";
import type { EducationEntry, EmploymentEntry } from "./types";

/** "לימודים" - ציר זמן קצר של מוסדות הלימוד */
export function EducationSection({
  education,
}: {
  education: EducationEntry[] | null | undefined;
}) {
  if (!education || education.length === 0) return null;
  return (
    <CardSection title="לימודים" icon={GraduationCap}>
      <div>
        {education.map((edu, idx) => (
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
                  {(edu.institution_type || edu.community) && <span>|</span>}
                  <span>{edu.city}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </CardSection>
  );
}

/** "תעסוקה" */
export function EmploymentSection({
  employment,
}: {
  employment: EmploymentEntry[] | null | undefined;
}) {
  if (!employment || employment.length === 0) return null;
  return (
    <CardSection title="תעסוקה" icon={Briefcase}>
      <div className="space-y-3">
        {employment.map((job, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-border bg-muted/50 p-3"
          >
            {job.category && (
              <p className="mb-1 text-caption font-bold text-muted-foreground uppercase">
                {employmentCategoryToHebrew(job.category)}
              </p>
            )}
            {job.role && <p className="text-body-sm font-bold">{job.role}</p>}
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
        ))}
      </div>
    </CardSection>
  );
}
