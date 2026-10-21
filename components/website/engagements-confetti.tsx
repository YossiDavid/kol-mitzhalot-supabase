"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { fireConfetti } from "@/features/engagements/lib/confetti";

/**
 * קונפטי באתר הציבורי: כשמדור "שידוכים שנסגרו" נכנס למסך - פרץ קונפטי
 * אחד, פעם אחת לגולש בכל ביקור (sessionStorage). מי שביקש להפחית תנועה
 * לא מקבל אנימציה (fireConfetti בודק זאת).
 */

const SEEN_KEY = "website-engagements-confetti-seen";
/** איזה חלק מהמדור צריך להיראות כדי שהחגיגה תתחיל */
const VISIBLE_THRESHOLD = 0.35;

function wasSeenThisVisit(): boolean {
  try {
    return window.sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeenThisVisit(): void {
  try {
    window.sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // אין גישה לאחסון (גלישה פרטית) - לכל היותר הקונפטי יופיע שוב
  }
}

export function EngagementsConfetti({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || wasSeenThisVisit()) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        markSeenThisVisit();
        fireConfetti().catch((error: unknown) => {
          console.error("[website/engagements-confetti]", error);
        });
      },
      { threshold: VISIBLE_THRESHOLD },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} data-testid="engagements-confetti">
      {children}
    </div>
  );
}
