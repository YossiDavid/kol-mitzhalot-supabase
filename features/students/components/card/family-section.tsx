import { Heart, Users } from "lucide-react";

import { jewishDateHebrew } from "@/lib/jewishDatte";
import { parentsStatusToHebrew } from "@/features/students/lib/profile-labels";

import { CardSection } from "./card-section";
import { InfoTag } from "./info-tag";
import { ParentCard } from "./parent-card";
import type { FamilyInfo, MechutanEntry, ParentsInfo } from "./types";

function holdingLabel(holding: string) {
  if (holding === "mother") return "האם";
  if (holding === "father") return "האב";
  return "שניהם";
}

/** "מצב ההורים": סטטוס, מי מגדל, פטירה ונישואים מחדש */
function ParentsStatusBox({ parentsInfo }: { parentsInfo: ParentsInfo }) {
  if (!parentsInfo?.status) return null;
  return (
    <div className="rounded-lg border border-border bg-muted/50 p-4">
      <h4 className="mb-3 text-body-sm font-bold">מצב ההורים</h4>
      <div className="grid grid-cols-3 gap-4">
        <InfoTag
          label="סטטוס"
          value={parentsStatusToHebrew(parentsInfo.status)}
        />
        {parentsInfo.holding && (
          <InfoTag label="מי מגדל" value={holdingLabel(parentsInfo.holding)} />
        )}
        {parentsInfo.deadParent === "father" && parentsInfo.fatherDeathDate && (
          <InfoTag
            label="תאריך פטירת האב"
            value={parentsInfo.fatherDeathDate}
          />
        )}
        {parentsInfo.isMotherRemarried && (
          <InfoTag
            label="האם נישאה מחדש"
            value={parentsInfo.isMotherRemarried === "true" ? "כן" : "לא"}
          />
        )}
        {parentsInfo.isMotherRemarried === "true" &&
          parentsInfo.newHusbandName && (
            <InfoTag label="שם הבעל החדש" value={parentsInfo.newHusbandName} />
          )}
        {parentsInfo.isFatherRemarried && (
          <InfoTag
            label="האם נישא מחדש"
            value={parentsInfo.isFatherRemarried === "true" ? "כן" : "לא"}
          />
        )}
        {parentsInfo.isFatherRemarried === "true" &&
          parentsInfo.newWifeName && (
            <InfoTag label="שם האשה החדשה" value={parentsInfo.newWifeName} />
          )}
      </div>
    </div>
  );
}

function FamilyInfoBox({ familyInfo }: { familyInfo: FamilyInfo }) {
  if (!familyInfo) return null;
  return (
    <div className="rounded-lg border border-border bg-muted/50 p-4">
      <h4 className="mb-3 text-body-sm font-bold">פרטים נוספים</h4>
      <div className="grid grid-cols-3 gap-4">
        {familyInfo.numberOfChildren && (
          <InfoTag
            label="מספר ילדים במשפחה"
            value={familyInfo.numberOfChildren}
          />
        )}
        {familyInfo.currentChildPlace && (
          <InfoTag label="מיקום במשפחה" value={familyInfo.currentChildPlace} />
        )}
        {familyInfo.about && (
          <InfoTag label="על המשפחה" value={familyInfo.about} />
        )}
      </div>
    </div>
  );
}

function MechutanimList({ familyInfo }: { familyInfo: FamilyInfo }) {
  const mechutanim: MechutanEntry[] | undefined = familyInfo?.mechutanim;
  if (!mechutanim || mechutanim.length === 0) return null;
  return (
    <div>
      <h4 className="mb-3 flex items-center gap-2 text-body-sm font-bold">
        <Heart size={16} /> מחותנים
      </h4>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {mechutanim.map((m, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-caption font-bold">
              {idx + 1}
            </div>
            <div>
              <p className="text-body-sm font-bold">
                {m.firstName} {m.lastName}
              </p>
              {m.city && (
                <p className="text-caption text-muted-foreground">{m.city}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** "רקע משפחתי" - זהה לגולש מחובר ולתצוגה הציבורית */
export function FamilySection({
  parentsInfo,
  familyInfo,
}: {
  parentsInfo: ParentsInfo;
  familyInfo: FamilyInfo;
}) {
  return (
    <CardSection title="רקע משפחתי" icon={Users}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ParentCard
            label="אבא"
            parent={parentsInfo?.father}
            grandFatherLabel="אביו:"
            grandMotherLabel="אמו:"
            jobItalic
          />
          <ParentCard
            label="אמא"
            parent={parentsInfo?.mother}
            grandFatherLabel="אביה:"
            grandMotherLabel="אימה:"
            maidenName={parentsInfo?.mother?.maidenName}
            deathNote={
              parentsInfo?.deadParent === "mother" &&
              parentsInfo?.motherDeathDate ? (
                <p className="mt-2 text-caption text-destructive">
                  נפטרה ב-
                  {jewishDateHebrew(parentsInfo.motherDeathDate)}
                </p>
              ) : null
            }
          />
        </div>
        <ParentsStatusBox parentsInfo={parentsInfo} />
        <FamilyInfoBox familyInfo={familyInfo} />
        <MechutanimList familyInfo={familyInfo} />
      </div>
    </CardSection>
  );
}
