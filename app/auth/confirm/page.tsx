import { ConfirmLinkPage } from "@/features/auth/components/confirm-link-page";
import { confirmPageMetadata } from "@/features/auth/lib/confirm-metadata";

export const metadata = confirmPageMetadata;

/**
 * השער הקלאסי: היעד מגיע ב-`?next=`. ה-GET מציג כפתור בלבד — האימות בלחיצה.
 */
export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ConfirmLinkPage searchParams={searchParams} />;
}
