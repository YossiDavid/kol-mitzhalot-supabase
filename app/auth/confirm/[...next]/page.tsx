import { ConfirmLinkPage } from "@/features/auth/components/confirm-link-page";
import { confirmPageMetadata } from "@/features/auth/lib/confirm-metadata";

export const metadata = confirmPageMetadata;

/**
 * אותו מסך כמו /auth/confirm, אבל היעד נישא כסגמנטים של הנתיב:
 * `/auth/confirm/app/shidduchim/<id>` מחזיר ל-`/app/shidduchim/<id>`.
 *
 * זה המסלול של Magic Link, כי תבנית המייל מוסיפה בעצמה
 * `?token_hash=...&type=...` אל `{{ .RedirectTo }}` — ולכן אי אפשר להעביר
 * שם `?next=`. הנתיב נבנה ב-buildConfirmPath ומסונן שוב בצד השרת.
 *
 * catch-all ולא סגמנט יחיד: כך המסלול עובד גם אם משהו בדרך פענח `%2F`
 * חזרה ללוכסנים ופיצל את היעד לכמה סגמנטים.
 */
export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ next: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const pathNext = params.then(({ next }) =>
    next?.length ? `/${next.join("/")}` : null,
  );
  return <ConfirmLinkPage searchParams={searchParams} pathNext={pathNext} />;
}
