"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Box, Page, PageHeader, PageHeaderSkeleton } from "@/components/layout";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Link from "next/link";
import { TermsVersionPanel } from "@/features/auth/components/terms-version-panel";
import { TERMS_CONTENT_KEY } from "@/features/auth/lib/terms";
import {
  describeTargetGroups,
  type TermsTargetGroup,
} from "@/features/auth/lib/terms-target-groups";

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
  // גרסת התוכן שפורסמה (רלוונטית לתקנון: עלייה בה מחייבת אישור מחדש)
  const [version, setVersion] = useState(0);
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
        setVersion(typeof data.version === "number" ? data.version : 0);
      }

      setLoading(false);
    }

    loadContent();
  }, [params, router, supabase]);

  /** שמירת התוכן. true = נשמר (ההודעה למשתמש כבר הוצגה) */
  const saveContent = async (): Promise<boolean> => {
    if (!key) return false;

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
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    if (await saveContent()) toast.success("התוכן נשמר בהצלחה");
    setSaving(false);
  };

  /**
   * שמירה ואז פרסום גרסה חדשה לקבוצות היעד (ריק = כולם) - כך הגרסה שמאשרים
   * היא הנוסח שבעורך
   */
  const handlePublishVersion = async (
    targetGroups: TermsTargetGroup[],
  ): Promise<boolean> => {
    setSaving(true);
    try {
      if (!(await saveContent())) return false;
      const { data, error } = await supabase.rpc(
        "publish_system_content_version",
        {
          p_key: key,
          p_target_groups: targetGroups.length > 0 ? targetGroups : null,
        },
      );
      if (error || typeof data !== "number") {
        console.error("Error publishing content version:", error);
        toast.error("פרסום הגרסה נכשל, נסו שוב");
        return false;
      }
      setVersion(data);
      toast.success(
        `גרסה ${data} פורסמה. ${describeTargetGroups(targetGroups)} יתבקשו לאשר אותה`,
      );
      return true;
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Page>
        <PageHeaderSkeleton actions={2} />
        <SkeletonRegion label="טוען תוכן...">
          <Box aria-hidden className="space-y-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-96 w-full" />
          </Box>
        </SkeletonRegion>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title={title}
        description={CONTENT_KEYS[key]?.description}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/app/admin/settings">ביטול</Link>
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "שומר..." : "שמור"}
            </Button>
          </div>
        }
      />
        {key === TERMS_CONTENT_KEY && (
          <TermsVersionPanel
            version={version}
            onPublish={handlePublishVersion}
            isDisabled={saving}
          />
        )}
        <Box className="space-y-4">
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
            <p className="text-body-sm text-muted-foreground mt-2">
              השתמש בסרגל הכלים לעיצוב התוכן
            </p>
          </div>
        </Box>
    </Page>
  );
}
