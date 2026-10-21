import type { Metadata } from "next";

// הדף עצמו הוא רכיב לקוח (טפסים) ולכן ה-metadata מוגדר כאן
export const metadata: Metadata = {
  title: "צרו קשר",
  description:
    "פנייה לצוות קול מצהלות, שליחת רעיון לשידוך או פרסום מודעת מאורסים. נחזור אליכם תוך 24 שעות בימי עסקים.",
};

export default function ContactLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
