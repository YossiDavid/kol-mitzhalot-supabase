/**
 * קונפטי לחגיגת שידוכים. הספרייה נטענת רק כשיש מה לחגוג (import דינמי),
 * ומי שביקש להפחית תנועה (prefers-reduced-motion) לא מקבל אנימציה בכלל -
 * רק את ההודעה.
 */

/** צבעי המותג לקונפטי (זהב, כחול, לבן) */
const COLORS = ["#d4af37", "#1e3a8a", "#ffffff", "#60a5fa"];
/** מעל הדיאלוג (z-50) */
const Z_INDEX = 100;
/** פרץ גדול: כמה שיגורים, ברווח קצר */
const BIG_BURST_COUNT = 4;
const BIG_BURST_GAP_MS = 350;

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

async function loadConfetti() {
  const confettiModule = await import("canvas-confetti");
  return confettiModule.default;
}

/** פרץ קטן אחד, מלמעלה-מרכז */
export async function fireConfetti(): Promise<void> {
  if (prefersReducedMotion()) return;
  const confetti = await loadConfetti();
  await confetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.3 },
    colors: COLORS,
    zIndex: Z_INDEX,
    disableForReducedMotion: true,
  });
}

/** חגיגה גדולה: שיגורים מהצדדים ומהמרכז, אחד אחרי השני */
export async function fireBigCelebration(): Promise<void> {
  if (prefersReducedMotion()) return;
  const confetti = await loadConfetti();
  const shared = {
    colors: COLORS,
    zIndex: Z_INDEX,
    disableForReducedMotion: true,
  };
  const launches: (Promise<unknown> | null)[] = [];
  for (let index = 0; index < BIG_BURST_COUNT; index += 1) {
    if (index > 0) await wait(BIG_BURST_GAP_MS);
    launches.push(
      confetti({
        ...shared,
        particleCount: 90,
        angle: 60,
        spread: 70,
        origin: { x: 0, y: 0.7 },
      }),
      confetti({
        ...shared,
        particleCount: 90,
        angle: 120,
        spread: 70,
        origin: { x: 1, y: 0.7 },
      }),
      confetti({
        ...shared,
        particleCount: 140,
        spread: 120,
        startVelocity: 45,
        origin: { y: 0.4 },
      }),
    );
  }
  await Promise.all(launches);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
