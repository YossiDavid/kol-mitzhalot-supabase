import Section from "@/components/layout/section";
import ShiduchDesk from "./shiduch-desk";
import { createClient } from "@/lib/supabase/server";

export default async function CanvasPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const favorites = await supabase
    .from("students")
    .select(`*,employment_history(*)`)
    .in("id", user?.user_metadata?.favorites || []);

  return (
    <Section containerClassName="py-10">
      <h1 className="text-center">לוח עבודה ליצירת שידוכים</h1>
      <p className="mx-auto max-w-2xl text-center text-balance">
        המועדפים שהוספתם מופיעים בתחתית הלוח. כדי להוסיף אותם לשידוך חדש פשוט יש
        לגרור את הכרטיס אל עבר התיבה הייעודית או ללחוץ על כפתור ״הוספה לשידוך״
        בתחתית הכרטיס
      </p>
      {/* שולחן העבודה עצמו (client) */}
      <ShiduchDesk
        initialFavorites={favorites.data || []}
      />
    </Section>
  );
}
