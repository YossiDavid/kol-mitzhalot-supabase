import Link from "next/link";
import { IdCard } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * הקישור לכרטיס המלא של מיועד בהצעה. כפתור מלא ולא קישור טקסט: משתמשים
 * פספסו את הקישור הקטן וחשבו שהסיכום הוא כל המידע שיש.
 */
export function FullCardLink({ studentId }: { studentId: string }) {
  return (
    <Button asChild size="sm" className="w-fit">
      <Link href={`/app/students/${studentId}`}>
        <IdCard aria-hidden />
        לכרטיס המלא
      </Link>
    </Button>
  );
}
