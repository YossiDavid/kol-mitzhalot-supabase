"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DashboardSection } from "@/components/layout";
import { Box } from "@/components/layout";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Link from "next/link";

const CONTENT_KEYS: Record<string, { title: string; description: string }> = {
  "privacy-policy": {
    title: "מדיניות פרטיות",
    description: "עריכת מדיניות הפרטיות של המערכת",
  },
  "terms-of-service": {
    title: "תנאי שימוש",
    description: "עריכת תנאי השימוש של המערכת",
  },
  "accessibility": {
    title: "הצהרת נגישות",
    description: "עריכת הצהרת הנגישות של המערכת",
  },
};

export default function EditContentPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const [key, setKey] = useState<string>("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadContent() {
      const resolvedParams = await params;
      const contentKey = resolvedParams.key;
      setKey(contentKey);

      const contentInfo = CONTENT_KEYS[contentKey];
      if (!contentInfo) {
        router.push("/app/admin/settings");
        return;
      }

      setTitle(contentInfo.title);

      // טעינת תוכן קיים
      const { data, error } = await supabase
        .from("system_content")
        .select("*")
        .eq("key", contentKey)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows returned
        console.error("Error loading content:", error);
        toast.error("שגיאה בטעינת התוכן");
      } else if (data) {
        setContent(data.content);
      }

      setLoading(false);
    }

    loadContent();
  }, [params, router, supabase]);

  const handleSave = async () => {
    if (!key) return;

    setSaving(true);

    const contentInfo = CONTENT_KEYS[key];
    const { error } = await supabase
      .from("system_content")
      .upsert(
        {
          key,
          title: contentInfo.title,
          content,
        },
        {
          onConflict: "key",
        }
      );

    if (error) {
      console.error("Error saving content:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      toast.error(`שגיאה בשמירת התוכן: ${error.message || "שגיאה לא ידועה"}`);
    } else {
      toast.success("התוכן נשמר בהצלחה");
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="space-y-10 py-4">
        <DashboardSection
          title="טוען..."
          subTitle=""
          button={<Button disabled>שמירה</Button>}
        >
          <div className="text-center py-10">טוען תוכן...</div>
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="space-y-10 py-4">
      <DashboardSection
        title={title}
        subTitle={CONTENT_KEYS[key]?.description || ""}
        button={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/app/admin/settings">ביטול</Link>
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "שומר..." : "שמור"}
            </Button>
          </div>
        }
      >
        <Box className="mt-6 space-y-4">
          <div>
            <Label htmlFor="content">תוכן</Label>
            <div className="mt-2">
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholder="התחל לכתוב את התוכן כאן..."
                className="min-h-[400px]"
              />
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              השתמש בסרגל הכלים לעיצוב התוכן
            </p>
          </div>
        </Box>
      </DashboardSection>
    </div>
  );
}
