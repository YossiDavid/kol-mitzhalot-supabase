import { Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  cellphoneTypeToHebrew,
  headCoverTypeToHebrew,
  planForLifeToHebrew,
  workStatusToHebrew,
} from "@/features/students/lib/profile-labels";

import { CardSection } from "./card-section";

type PartnerPreferences = {
  additional_information?: string | null;
  age_min?: number | null;
  age_max?: number | null;
  work_status?: string | null;
  head_cover_type?: string | null;
  plan_for_life?: string | null;
  cellphone_type?: string | null;
  preferred_countries?: string[] | null;
  about_partner?: string | null;
} | null;

function PreferenceBox({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className="text-body-sm font-bold">{children}</p>
    </div>
  );
}

/** "מה אני מחפש/ת" - העדפות בן/בת הזוג. למשתמש מחובר בלבד */
export function PartnerPreferencesSection({
  preferences,
  gender,
}: {
  preferences: PartnerPreferences;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gender: any;
}) {
  if (!preferences) return null;

  const workStatus = workStatusToHebrew(preferences.work_status, gender);

  return (
    <CardSection
      title={gender === "male" ? "מה אני מחפש?" : "מה אני מחפשת"}
      icon={Star}
    >
      <div className="space-y-4">
        {preferences.additional_information && (
          <div className="rounded-lg border-r-4 border-primary bg-muted/50 p-4">
            <p className="font-medium text-foreground italic">
              "{preferences.additional_information}"
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          {preferences.age_min && preferences.age_max && (
            <PreferenceBox label="טווח גילאים">
              {preferences.age_min} - {preferences.age_max}
            </PreferenceBox>
          )}
          {workStatus && (
            <PreferenceBox label="סטטוס תעסוקתי מבוקש">
              {workStatus}
            </PreferenceBox>
          )}
          {preferences.head_cover_type && (
            <PreferenceBox label="סוג כיסוי ראש רצוי">
              {headCoverTypeToHebrew(preferences.head_cover_type)}
            </PreferenceBox>
          )}
          {preferences.plan_for_life && (
            <PreferenceBox label="תכנון לחיים">
              {planForLifeToHebrew(preferences.plan_for_life)}
            </PreferenceBox>
          )}
          {preferences.cellphone_type && (
            <PreferenceBox label="סוג טלפון מקובל">
              {cellphoneTypeToHebrew(preferences.cellphone_type)}
            </PreferenceBox>
          )}
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="mb-2 text-caption text-muted-foreground">
            ארץ / מדינות מועדפות
          </p>
          {!preferences.preferred_countries ||
          preferences.preferred_countries.length === 0 ? (
            <p className="text-body-sm font-bold">ללא העדפה — כל הארצות</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {preferences.preferred_countries.map((country, idx) => (
                <Badge key={idx} variant="outline">
                  {country}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {preferences.about_partner && (
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="mb-1 text-caption text-muted-foreground">
              אופי המבוקש
            </p>
            <p className="text-body-sm">{preferences.about_partner}</p>
          </div>
        )}
      </div>
    </CardSection>
  );
}
