"use client";

import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField } from "@/components/ui/form";
import { FormFieldShell } from "@/components/ui/form-field-shell";
import { FormFields } from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type {
  CommunityFormState,
  CommunityRow,
} from "@/features/communities/lib/community-form-schema";
import { describeCommunityUsage } from "@/features/communities/lib/community-usage";

/** דיאלוג יצירה ועריכה של ערך במאגר החסידויות והקהילות (ניהול) */
export function CommunityFormDialog({
  open,
  onOpenChange,
  form,
  editing,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<CommunityFormState>;
  /** הערך הנערך, או null ביצירה. השימוש שלו קובע אם מוצגת אזהרת שינוי השם */
  editing: CommunityRow | null;
  onSubmit: (values: CommunityFormState) => Promise<void>;
}) {
  const { isSubmitting } = form.formState;
  const showRenameWarning = editing !== null && editing.usageCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? "עריכת חסידות או קהילה" : "חסידות או קהילה חדשה"}
          </DialogTitle>
          <DialogDescription>
            ערכים אלה מוצעים לבחירה בשדה &quot;חסידות או קהילה&quot; באשף יצירת
            כרטיס מיועד.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          {/* noValidate: ההודעות בעברית מגיעות מהסכמה ולא מהדפדפן */}
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <FormFields>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormFieldShell label="שם החסידות או הקהילה" required>
                    <Input
                      {...field}
                      placeholder="לדוגמה: בעלזא"
                      disabled={isSubmitting}
                    />
                  </FormFieldShell>
                )}
              />

              {showRenameWarning ? (
                <p className="rounded-md border border-dashed p-3 text-body-sm text-muted-foreground">
                  הערך מופיע ב{describeCommunityUsage(editing)}. שינוי השם כאן
                  מעדכן את המאגר בלבד - הכרטיסים הקיימים ישמרו על הטקסט הישן.
                  כדי להעביר גם אותם יש להשתמש במיזוג.
                </p>
              ) : null}

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div>
                      <Label htmlFor="communityActive">קהילה פעילה</Label>
                      <p className="text-body-sm text-muted-foreground">
                        ערך לא פעיל נשאר בכרטיסים הקיימים אך אינו מוצע לבחירה
                        חדשה
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        id="communityActive"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                  </div>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  ביטול
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "שומר..." : "שמירה"}
                </Button>
              </DialogFooter>
            </FormFields>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
