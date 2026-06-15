import { redirect } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { Section } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createPost } from "../actions";

export default async function CreateForumPostPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = user?.user_metadata?.role;
  if (role !== "admin" && role !== "shadchan") {
    redirect("/app/forums");
  }

  const { data: categories } = await supabase
    .from("forum_categories")
    .select("id, name, slug")
    .order("sort_order", { ascending: true });

  return (
    <Section containerClassName="py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">נושא חדש בפורום</h1>
        <Button asChild variant="outline">
          <Link href="/app/forums">חזרה לפורום</Link>
        </Button>
      </div>

      <form action={createPost} className="mt-8 max-w-2xl space-y-6">
        <div className="space-y-2">
          <Label htmlFor="category_id">קטגוריה</Label>
          <select
            id="category_id"
            name="category_id"
            className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <option value="">ללא קטגוריה</option>
            {(categories ?? []).map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">כותרת הנושא</Label>
          <Input
            id="title"
            name="title"
            placeholder="כתוב כותרת ברורה וממוקדת..."
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="content">תוכן</Label>
          <Textarea
            id="content"
            name="content"
            placeholder="שתף את המחשבות שלך עם קהילת השדכנים..."
            rows={10}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags">תגיות (מופרדות בפסיקים)</Label>
          <Input
            id="tags"
            name="tags"
            placeholder="לדוגמה: שידוכים, ייעוץ, הלכה"
          />
          <p className="text-muted-foreground text-xs">
            הוסף תגיות כדי לעזור לאחרים למצוא את הנושא
          </p>
        </div>

        <div className="flex gap-3">
          <Button type="submit">פרסם נושא</Button>
          <Button asChild variant="outline">
            <Link href="/app/forums">ביטול</Link>
          </Button>
        </div>
      </form>
    </Section>
  );
}
