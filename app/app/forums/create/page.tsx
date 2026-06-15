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
