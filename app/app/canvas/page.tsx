import Section from "@/components/layout/section";
import ShiduchDesk from "@/features/shidduchim/components/shiduch-desk";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/user";
import { unstable_noStore as noStore } from "next/cache";

export default async function CanvasPage() {
  noStore();
  const supabase = await createClient();

  const user = await getUser();

  const favorites = await supabase
    .from("students")
    .select(`*,employment_history(*),partner_preferences(*)`)
    .in("id", user?.user_metadata?.favorites || []);

  return (
    <Section containerClassName="py-4 md:py-10">
      <h1 className="text-center">לוח עבודה ליצירת שידוכים</h1>
      <p className="mx-auto max-w-2xl text-center text-balance">
        המועדפים שהוספתם מופיעים בתחתית הלוח. כדי להוסיף אותם לשידוך חדש פשוט יש
        לגרור את הכרטיס אל עבר התיבה הייעודית או ללחוץ על כפתור ״הוספה לשידוך״
        בתחתית הכרטיס
      </p>
      {/* שולחן העבודה עצמו (client) */}
      <ShiduchDesk initialFavorites={favorites.data || []} />
    </Section>
  );
}
