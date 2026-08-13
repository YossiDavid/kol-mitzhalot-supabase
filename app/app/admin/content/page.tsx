import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DashboardSection } from "@/components/layout";
import { FileText, Heart, Star } from "lucide-react";

export default function ContentHubPage() {
  return (
    <div className="space-y-10 py-4">
      <DashboardSection
        title="ניהול תוכן"
        subTitle="מאמרים, מאורסים, והמלצות רבנים"
        button={
          <Button asChild variant="outline">
            <Link href={"/app/admin" as any}>חזרה לדשבורד</Link>
          </Button>
        }
      >
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          <Link href={"/app/admin/content/articles" as any}>
            <div className="cursor-pointer rounded-lg border p-6 transition-colors hover:bg-accent">
              <FileText className="mb-4 h-8 w-8" />
              <h3 className="mb-2 text-subtitle font-semibold">מאמרים</h3>
              <p className="text-body-sm text-muted-foreground">
                יצירה, עריכה ופרסום מאמרים לכל קטגוריה
              </p>
            </div>
          </Link>

          <Link href={"/app/admin/content/engagements" as any}>
            <div className="cursor-pointer rounded-lg border p-6 transition-colors hover:bg-accent">
              <Heart className="mb-4 h-8 w-8" />
              <h3 className="mb-2 text-subtitle font-semibold">מודעות מאורסים</h3>
              <p className="text-body-sm text-muted-foreground">
                אישור ופרסום מודעות שידוכים שנסגרו
              </p>
            </div>
          </Link>

          <Link href={"/app/admin/content/endorsements" as any}>
            <div className="cursor-pointer rounded-lg border p-6 transition-colors hover:bg-accent">
              <Star className="mb-4 h-8 w-8" />
              <h3 className="mb-2 text-subtitle font-semibold">המלצות רבנים</h3>
              <p className="text-body-sm text-muted-foreground">
                ניהול הסכמות ומלצות רבני הקהילה
              </p>
            </div>
          </Link>
        </div>
      </DashboardSection>
    </div>
  );
}
