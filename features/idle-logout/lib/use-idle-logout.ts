"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  broadcastLogout,
  clearImpersonationBackup,
  parseTimestamp,
  readLogoutPath,
  readSharedActivity,
  writeSharedActivity,
} from "@/features/idle-logout/lib/idle-activity-store";
import {
  IDLE_ACTIVITY_STORAGE_KEY,
  IDLE_LOGOUT_LOGIN_PATH,
  IDLE_LOGOUT_STORAGE_KEY,
  IDLE_WARNING_MS,
} from "@/features/idle-logout/lib/idle-logout-model";
import { createClient } from "@/lib/supabase/client";

/** בדיקת הזמן שנותר - פעם בשנייה (גם קצב הספירה לאחור בדיאלוג) */
const CHECK_INTERVAL_MS = 1000;

/** כתיבה ל-localStorage לכל היותר פעם בכמה שניות (תנועת עכבר רציפה) */
const WRITE_THROTTLE_MS = 5000;

/** אירועים שנחשבים פעילות של המשתמש */
const ACTIVITY_EVENTS = [
  "pointerdown",
  "pointermove",
  "keydown",
  "wheel",
  "scroll",
  "touchstart",
] as const;

const LOGIN_PATH = "/auth/login";

export interface IdleLogoutState {
  /** הזמן שנותר עד ההתנתקות כשהאזהרה מוצגת; null = אין אזהרה */
  warningRemainingMs: number | null;
  /** "להישאר מחובר": מאפס את הספירה בכל הלשוניות */
  stay: () => void;
  /** "להתנתק": התנתקות מיידית (בלי הודעת חוסר פעילות) */
  logoutNow: () => void;
}

/**
 * ספירת חוסר פעילות משותפת לכל הלשוניות. פעילות בלשונית אחת שומרת את כולן
 * בחיים (אירוע storage), והתנתקות באחת מנתקת את כולן.
 *
 * בזמן שהאזהרה מוצגת, פעילות "סבילה" (עכבר, גלילה) לא מבטלת אותה - רק
 * "להישאר מחובר" או פעילות בלשונית אחרת.
 */
export function useIdleLogout(timeoutMs: number): IdleLogoutState {
  const warningMs = Math.min(IDLE_WARNING_MS, timeoutMs / 2);
  const lastActivityRef = useRef(0);
  const lastWriteRef = useRef(0);
  const isWarningRef = useRef(false);
  const isLoggingOutRef = useRef(false);
  const [warningRemainingMs, setWarningRemainingMs] = useState<number | null>(
    null,
  );

  const signOut = useCallback(async (isIdle: boolean) => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    const loginPath = isIdle ? IDLE_LOGOUT_LOGIN_PATH : LOGIN_PATH;
    broadcastLogout(loginPath);
    clearImpersonationBackup();
    try {
      // local: מנתק את הדפדפן הזה בלבד; במכשירים אחרים המשתמש אולי פעיל
      await createClient().auth.signOut({ scope: "local" });
    } catch (error) {
      console.error("[idle-logout] ההתנתקות נכשלה", error);
    }
    // ניווט מלא ולא router.push: מנקה מהזיכרון את כל הנתונים של הסשן
    window.location.replace(loginPath);
  }, []);

  const markActivity = useCallback((isForced: boolean) => {
    if (isLoggingOutRef.current) return;
    if (isWarningRef.current && !isForced) return;
    const now = Date.now();
    lastActivityRef.current = now;
    if (isForced || now - lastWriteRef.current >= WRITE_THROTTLE_MS) {
      lastWriteRef.current = now;
      writeSharedActivity(now);
    }
  }, []);

  const check = useCallback(() => {
    if (isLoggingOutRef.current) return;
    const remaining = lastActivityRef.current + timeoutMs - Date.now();
    if (remaining <= 0) {
      void signOut(true);
      return;
    }
    const isWarning = remaining <= warningMs;
    isWarningRef.current = isWarning;
    setWarningRemainingMs(isWarning ? remaining : null);
  }, [signOut, timeoutMs, warningMs]);

  useEffect(() => {
    // טעינת הדף היא פעילות; לוקחים גם פעילות חדשה יותר מלשונית אחרת
    lastActivityRef.current = Math.max(Date.now(), readSharedActivity() ?? 0);
    markActivity(true);

    const onActivity = () => markActivity(false);
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      // קודם בודקים: לשונית שחוזרים אליה אחרי שהזמן עבר - מתנתקת
      check();
      markActivity(false);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === IDLE_LOGOUT_STORAGE_KEY && event.newValue) {
        // לשונית אחרת כבר התנתקה; כאן רק עוברים לדף ההתחברות
        isLoggingOutRef.current = true;
        window.location.replace(
          readLogoutPath(event.newValue, IDLE_LOGOUT_LOGIN_PATH),
        );
        return;
      }
      if (event.key !== IDLE_ACTIVITY_STORAGE_KEY) return;
      const at = parseTimestamp(event.newValue);
      if (at && at > lastActivityRef.current) {
        lastActivityRef.current = at;
        check();
      }
    };

    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, onActivity, {
        capture: true,
        passive: true,
      });
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("storage", onStorage);
    const interval = window.setInterval(check, CHECK_INTERVAL_MS);

    return () => {
      for (const name of ACTIVITY_EVENTS) {
        window.removeEventListener(name, onActivity, { capture: true });
      }
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(interval);
    };
  }, [check, markActivity]);

  const stay = useCallback(() => {
    isWarningRef.current = false;
    markActivity(true);
    setWarningRemainingMs(null);
  }, [markActivity]);

  const logoutNow = useCallback(() => {
    void signOut(false);
  }, [signOut]);

  return { warningRemainingMs, stay, logoutNow };
}
