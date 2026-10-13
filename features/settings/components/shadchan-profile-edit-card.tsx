import type { Route } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const EDIT_PROFILE_HREF = "/app/settings/shadchan" as Route;

/** כרטיס בהגדרות לשדכן מאושר: מעבר לעריכת הפרופיל הציבורי שלו. */
export function ShadchanProfileEditCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>פרופיל שדכן</CardTitle>
        <CardDescription>
          עדכון הפרטים שמוצגים בכרטיס ובפרופיל שלך: ביוגרפיה, ניסיון, התמחויות,
          פרטי קשר ושפות.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link href={EDIT_PROFILE_HREF}>עריכת פרופיל שדכן</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
