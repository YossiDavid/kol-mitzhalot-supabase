import { redirect } from "next/navigation";

import {
  ADMIN_NAV_SECTIONS,
  adminSectionLandingUrl,
} from "@/components/sidebar/admin-nav-items";

// הדפים עברו לתתי-פריטים של "תוכן האתר" בסיידבר; המסלול נשאר חי לקישורים
// ישנים ומפנה לתת-העמוד הראשון, כמו לחיצה על הפריט העליון.
export default function ContentHubPage() {
  const contentSection = ADMIN_NAV_SECTIONS.find(
    (section) => section.key === "content",
  );
  redirect(
    contentSection ? adminSectionLandingUrl(contentSection) : "/app/admin",
  );
}
