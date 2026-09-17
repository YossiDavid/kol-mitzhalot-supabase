import { unstable_noStore as noStore } from "next/cache";
import { type NextRequest } from "next/server";

import { confirmMagicLink } from "@/features/auth/lib/confirm-magic-link";

/** השער הקלאסי: היעד מגיע ב-`?next=`. */
export async function GET(request: NextRequest) {
  noStore();
  return confirmMagicLink(request);
}
