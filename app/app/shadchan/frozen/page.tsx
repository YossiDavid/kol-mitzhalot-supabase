import type { Metadata } from "next";

import { ShadchanFrozenNotice } from "@/features/shadchanim/components/shadchan-frozen-notice";

export const metadata: Metadata = { title: "חשבון השדכן מוקפא" };

/** יעד ההפניה של שערים שאינם יכולים להחליף את התוכן (למשל לוח ההתאמות) */
export default function ShadchanFrozenPage() {
  return <ShadchanFrozenNotice />;
}
