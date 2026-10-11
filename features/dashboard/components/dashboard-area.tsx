/**
 * אזור בדשבורד עם כותרת h2 ("כלי שדכן" / "האזור האישי שלי"). הרמה העליונה
 * בהיררכיה: title בהיר וכבד (800), מעל כותרות המקטעים (h3, subtitle).
 */
export function DashboardArea({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-10">
      <h2
        id={id}
        className="border-b border-border pb-2 text-title font-extrabold text-primary"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
