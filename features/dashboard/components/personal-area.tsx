import Link from "next/link";

import { PERSONAL_AREA_LABEL } from "@/components/sidebar/nav-items";
import { DashboardSection } from "@/components/layout";
import { Button } from "@/components/ui/button";
import type { ParentProposal } from "@/features/shidduchim/lib/proposals-data";
import type { StudentTableRow } from "@/features/students/components/students-table";
import { CARD_GUIDANCE_SHORT } from "@/features/students/lib/third-party-card";
import {
  ownCardsHeading,
  ownCardsShadchanimSubtitle,
} from "@/features/students/lib/own-cards-heading";

import { DashboardArea } from "./dashboard-area";
import type { DashboardChat } from "./chat-rooms-list";
import { ActiveShidduchim, Chat, Children, ShadchanimList } from "./user";

type PersonalAreaProps = {
  /** כשהמשתמש שדכן/מנהל: האזור עטוף בכותרת, והמקטעים מתחתיה */
  isInsideArea: boolean;
  openProposals: ParentProposal[];
  chats: DashboardChat[];
  ownCards: StudentTableRow[];
  /** אין שדכנים שפעלו בשבילך. כשלא ידוע (שגיאה) - false, ולא מסתירים */
  hasNoShadchanim: boolean;
};

/**
 * מקטעי הורה/בעל כרטיס. לשדכן/מנהל בלי כרטיסים משלו מוצג רק מקטע
 * הכרטיסים (להוספת כרטיס); מקטע שיש בו נתונים אינו מוסתר לעולם.
 */
export function PersonalArea({
  isInsideArea,
  openProposals,
  chats,
  ownCards,
  hasNoShadchanim,
}: PersonalAreaProps) {
  const headingLevel = isInsideArea ? "h3" : "h2";
  const isDecluttered = isInsideArea && ownCards.length === 0;
  const showProposals = !isDecluttered || openProposals.length > 0;
  const showChats = !isDecluttered || chats.length > 0;
  const showShadchanim = !isDecluttered || !hasNoShadchanim;

  const sections = (
    <>
      {showProposals && (
        <DashboardSection
          headingLevel={headingLevel}
          title="הצעות פתוחות"
          subTitle="הצעות חדשות או מתקדמות שממתינות לטיפולך"
          button={
            <Button asChild>
              <Link href={"/app/proposals" as never}>לכל ההצעות</Link>
            </Button>
          }
        >
          <ActiveShidduchim shiduchim={openProposals} />
        </DashboardSection>
      )}
      {showChats && (
        <DashboardSection
          headingLevel={headingLevel}
          title={isInsideArea ? "הודעות משדכנים" : "הודעות אחרונות"}
          subTitle={
            isInsideArea
              ? "שיחות על הכרטיסים שלך ועל הצעות שקיבלת"
              : "שאלות ותשובות חדשות שקיבלת משדכנים בצ'אט"
          }
          button={
            <Button asChild>
              <Link href="/app/chats">
                {isInsideArea ? "לכל הצ'אטים" : "למעבר לצ׳אט"}
              </Link>
            </Button>
          }
        >
          <Chat chats={chats} />
        </DashboardSection>
      )}
      <DashboardSection
        headingLevel={headingLevel}
        title={ownCardsHeading(ownCards)}
        subTitle="מגיל 17 ועד החתונה בעז”ה"
        button={
          <Button asChild>
            <Link href="/app/students/create">להוספת מיועד/ת</Link>
          </Button>
        }
      >
        <p
          className="mb-3 text-body-sm text-muted-foreground"
          data-testid="card-guidance-note"
        >
          {CARD_GUIDANCE_SHORT}
        </p>
        <Children childs={ownCards} caption={ownCardsHeading(ownCards)} />
      </DashboardSection>
      {showShadchanim && (
        <DashboardSection
          headingLevel={headingLevel}
          title="שדכנים שפעלו בשבילך"
          subTitle={ownCardsShadchanimSubtitle(ownCards)}
          button={
            <Button asChild>
              <Link href="/app/shadchanim">לכל השדכנים</Link>
            </Button>
          }
        >
          <ShadchanimList />
        </DashboardSection>
      )}
    </>
  );

  if (!isInsideArea) return sections;

  return (
    <DashboardArea id="dashboard-area-personal" title={PERSONAL_AREA_LABEL}>
      {sections}
    </DashboardArea>
  );
}
