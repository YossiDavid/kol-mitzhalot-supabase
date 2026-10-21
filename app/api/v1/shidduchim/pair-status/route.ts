import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  findPairBlocks,
  type ProposalBlock,
} from "@/features/shidduchim/lib/proposal-gate";
import { isActiveShadchan } from "@/features/shadchanim/lib/shadchan-access";
import { hasRole } from "@/lib/user";

const idSchema = z.guid();

export async function GET(req: NextRequest) {
  noStore();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const groomId = req.nextUrl.searchParams.get("groomId");
  const brideId = req.nextUrl.searchParams.get("brideId");

  if (
    !idSchema.safeParse(groomId).success ||
    !idSchema.safeParse(brideId).success
  ) {
    return NextResponse.json(
      { error: "חסרים groomId / brideId" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("shidduchim")
    .select("id, status, shadchan_id, sent_at, created_at")
    .eq("groom_id", groomId!)
    .eq("bride_id", brideId!);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "שגיאת מסד" }, { status: 500 });
  }

  // חסימות הצמד (אישור הנהלה, צד שלישי, כהן וגרושה) - רק למי שמציע הצעות,
  // כדי שהלוח יחסום מראש ולא אחרי הלחיצה
  const isAdmin = hasRole(user, "admin");
  let blocks: ProposalBlock[] = [];
  if (isAdmin || (await isActiveShadchan(user))) {
    try {
      blocks = await findPairBlocks(admin, groomId!, brideId!, { isAdmin });
    } catch (e) {
      console.error(e);
      return NextResponse.json({ error: "שגיאת מסד" }, { status: 500 });
    }
  }

  return NextResponse.json({ rows: data || [], blocks });
}
