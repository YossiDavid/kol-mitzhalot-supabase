"use client";

import { useCallback, useSyncExternalStore, type ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

// כלי פיתוח בלבד: מעבר בין שלבי אשף הקו״ח בלי למלא שדות חובה.
// Next מחליף את process.env.NODE_ENV בזמן הבנייה, והמימוש נבחר ברמת המודול -
// ב-production נבחרים המימושים הריקים, והקוד של הבורר נמחק מהבנייה.
// ברירת המחדל כבויה, כדי שבדיקות ה-e2e (שרצות מול pnpm dev) יבדקו את
// החסימה האמיתית; הבחירה נשמרת בדפדפן.

const IS_DEVELOPMENT = process.env.NODE_ENV === "development";
const STORAGE_KEY = "dev:student-form:skip-step-validation";
const SWITCH_ID = "dev-skip-step-validation";

type SkipStepValidationState = readonly [boolean, (isEnabled: boolean) => void];

type DevSkipStepValidationToggleProps = {
  isEnabled: boolean;
  onChange: (isEnabled: boolean) => void;
};

const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readStoredPreference(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function storePreference(isEnabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(isEnabled));
  } catch {
    // אחסון חסום (למשל גלישה פרטית) - הבחירה לא תישמר
  }
  listeners.forEach((listener) => listener());
}

function useStoredSkipStepValidation(): SkipStepValidationState {
  // בשרת ובהידרציה false, ואחריה הערך מהדפדפן - בלי אי-התאמה בהידרציה
  const isEnabled = useSyncExternalStore(
    subscribe,
    readStoredPreference,
    () => false,
  );
  const update = useCallback((next: boolean) => storePreference(next), []);
  return [isEnabled, update] as const;
}

const NEVER_SKIP: SkipStepValidationState = [false, () => {}];

function useNeverSkipStepValidation(): SkipStepValidationState {
  return NEVER_SKIP;
}

function SkipStepValidationToggle({
  isEnabled,
  onChange,
}: DevSkipStepValidationToggleProps) {
  return (
    <div className="flex w-fit items-center gap-2 rounded-md border border-dashed border-warning bg-warning-muted px-3 py-2 text-warning-muted-foreground">
      <Switch id={SWITCH_ID} checked={isEnabled} onCheckedChange={onChange} />
      <Label htmlFor={SWITCH_ID} className="text-caption">
        מעבר בין שלבים בלי ולידציה (development בלבד)
      </Label>
    </div>
  );
}

/** האם לדלג על ולידציית שלב. מחוץ ל-development תמיד false */
export const useDevSkipStepValidation: () => SkipStepValidationState =
  IS_DEVELOPMENT ? useStoredSkipStepValidation : useNeverSkipStepValidation;

/** הבורר מוצג רק ב-development */
export const DevSkipStepValidationToggle: (
  props: DevSkipStepValidationToggleProps,
) => ReactNode = IS_DEVELOPMENT ? SkipStepValidationToggle : () => null;
