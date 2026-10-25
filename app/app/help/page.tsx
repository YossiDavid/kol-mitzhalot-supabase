import { CircleHelp } from "lucide-react";

import { Box, Page, PageHeader } from "@/components/layout";
import {
  SHADCHANIM_GUIDE,
  USERS_GUIDE,
  type HelpGuide,
} from "@/features/help/help-content";
import { getUser, hasRole } from "@/lib/user";

function GuideSection({ guide, isOpenByDefault }: { guide: HelpGuide; isOpenByDefault: boolean }) {
  return (
    <section aria-labelledby={`help-${guide.id}`} className="space-y-3">
      <div>
        <h2 id={`help-${guide.id}`} className="text-title font-bold">
          {guide.title}
        </h2>
        <p className="text-body-sm text-muted-foreground">{guide.intro}</p>
      </div>
      <div className="space-y-2">
        {guide.topics.map((topic, index) => (
          <Box key={topic.title} className="p-0">
            <details open={isOpenByDefault && index === 0} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-bold">
                <CircleHelp className="size-4 text-primary" aria-hidden />
                {topic.title}
              </summary>
              <ol className="list-decimal space-y-1.5 px-4 pb-4 ps-10 text-body-sm">
                {topic.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </details>
          </Box>
        ))}
      </div>
    </section>
  );
}

/** הוראות שימוש: המדריך הרלוונטי לתפקיד קודם (שדכן רואה את שניהם) */
export default async function HelpPage() {
  const user = await getUser();
  const isShadchan = !!user && (hasRole(user, "shadchan") || hasRole(user, "admin"));
  const guides = isShadchan ? [SHADCHANIM_GUIDE, USERS_GUIDE] : [USERS_GUIDE];

  return (
    <Page>
      <PageHeader
        title="הוראות שימוש"
        description="מדריך קצר לפעולות העיקריות במערכת. לשאלות נוספות - צ'אט עם ההנהלה או עמוד התמיכה."
      />
      {guides.map((guide, index) => (
        <GuideSection key={guide.id} guide={guide} isOpenByDefault={index === 0} />
      ))}
    </Page>
  );
}
