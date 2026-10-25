"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Box } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  ANNOUNCEMENT_AUDIENCES,
  AUDIENCE_LABELS,
  SYSTEM_ANNOUNCEMENT_BODY_MAX,
  SYSTEM_ANNOUNCEMENT_TITLE_MAX,
  type AnnouncementAudience,
} from "@/features/announcements/lib/announcements";

/** יצירת הודעת מערכת: באנר בכניסה לכל הקהל שנבחר, עד "קראתי" */
export function AnnouncementForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<AnnouncementAudience>("all");
  const [notifyShadchanim, setNotifyShadchanim] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error("נא למלא כותרת ותוכן");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/v1/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, audience, notifyShadchanim }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "שמירת ההודעה נכשלה");
        return;
      }
      toast.success("ההודעה פורסמה ותוצג בכניסה לאתר");
      setTitle("");
      setBody("");
      setNotifyShadchanim(false);
      router.refresh();
    } catch (error) {
      console.error("[announcements/form] submit failed", error);
      toast.error("שמירת ההודעה נכשלה");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Box>
      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="announcement-title">כותרת</Label>
          <Input
            id="announcement-title"
            value={title}
            maxLength={SYSTEM_ANNOUNCEMENT_TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="announcement-body">תוכן ההודעה</Label>
          <Textarea
            id="announcement-body"
            rows={4}
            value={body}
            maxLength={SYSTEM_ANNOUNCEMENT_BODY_MAX}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <div className="grid gap-2 md:w-72">
          <Label htmlFor="announcement-audience">למי</Label>
          <NativeSelect
            id="announcement-audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value as AnnouncementAudience)}
          >
            {ANNOUNCEMENT_AUDIENCES.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {AUDIENCE_LABELS[value]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        {audience === "shadchanim" && (
          <label className="flex items-center gap-2 text-body-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={notifyShadchanim}
              onChange={(e) => setNotifyShadchanim(e.target.checked)}
            />
            לשלוח גם התראה בפעמון ומייל לכל השדכנים
          </label>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "מפרסם..." : "פרסום ההודעה"}
          </Button>
        </div>
      </form>
    </Box>
  );
}
