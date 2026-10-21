"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveIdleLogoutMinutes } from "@/app/app/admin/settings/idle-logout-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  IDLE_LOGOUT_MAX_MINUTES,
  IDLE_LOGOUT_MESSAGES,
  IDLE_LOGOUT_PRESETS,
  formatIdleMinutes,
  idleLogoutMinutesSchema,
} from "@/features/idle-logout/lib/idle-logout-model";

const CHOICES = [0, ...IDLE_LOGOUT_PRESETS] as const;
const INPUT_ID = "idle-logout-minutes-input";
const ERROR_ID = "idle-logout-minutes-error";

/** טופס זמן ההתנתקות האוטומטית: בחירה מהירה או מספר דקות חופשי. 0 = כבוי */
export function IdleLogoutForm({ initialMinutes }: { initialMinutes: number }) {
  const [value, setValue] = useState(String(initialMinutes));
  const [savedMinutes, setSavedMinutes] = useState(initialMinutes);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSave = () => {
    const parsed =
      value.trim() === ""
        ? null
        : idleLogoutMinutesSchema.safeParse(value.trim());
    if (!parsed?.success) {
      setError(parsed?.error.issues[0]?.message ?? "יש להזין מספר דקות");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await saveIdleLogoutMinutes(parsed.data);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setValue(String(result.minutes));
      setSavedMinutes(result.minutes);
      toast.success(
        result.minutes === 0
          ? IDLE_LOGOUT_MESSAGES.disabled
          : IDLE_LOGOUT_MESSAGES.saved,
      );
    });
  };

  return (
    <Card className="gap-3" data-testid="idle-logout-setting">
      <div className="space-y-1 text-right">
        <Label htmlFor={INPUT_ID} className="text-body font-semibold">
          התנתקות אוטומטית
        </Label>
        <p className="text-body-sm text-muted-foreground">
          משתמש מחובר שלא היה פעיל באתר במשך הזמן הזה (בכל הלשוניות) מנותק
          אוטומטית. דקה לפני כן מוצגת לו שאלה &quot;עדיין כאן?&quot;. 0 = כבוי.
          מצב נוכחי: {formatIdleMinutes(savedMinutes)}.
        </p>
      </div>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="בחירה מהירה"
      >
        {CHOICES.map((minutes) => (
          <Button
            key={minutes}
            type="button"
            size="sm"
            variant={value === String(minutes) ? "default" : "outline"}
            aria-pressed={value === String(minutes)}
            disabled={isPending}
            onClick={() => {
              setValue(String(minutes));
              setError(null);
            }}
          >
            {formatIdleMinutes(minutes)}
          </Button>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Input
              id={INPUT_ID}
              type="number"
              inputMode="numeric"
              min={0}
              max={IDLE_LOGOUT_MAX_MINUTES}
              step={1}
              dir="ltr"
              className="w-32 text-start"
              value={value}
              disabled={isPending}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? ERROR_ID : undefined}
              onChange={(event) => setValue(event.target.value)}
            />
            <span className="text-body-sm text-muted-foreground">דקות</span>
          </div>
          {error ? (
            <p
              id={ERROR_ID}
              role="alert"
              className="text-body-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          onClick={onSave}
          // שם נגיש ייחודי: בדף יש גם את "שמירה" של אימייל יצירת הקשר
          aria-label="שמירת זמן ההתנתקות"
          disabled={isPending || value.trim() === String(savedMinutes)}
        >
          {isPending ? "שומר..." : "שמירה"}
        </Button>
      </div>
    </Card>
  );
}
