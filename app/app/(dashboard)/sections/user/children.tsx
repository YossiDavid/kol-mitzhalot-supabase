"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import calculateAge from "@/lib/calculateAge";
import { User } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { Box } from "@/components/layout";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";

type Child = {
  id: string;
  in_shidduchim: boolean;
  last_name: string;
  first_name: string;
  description: string;
  image: string;
  permalink: string;
  personal_status: "married" | "engaged" | "single";
  parents_info?: {
    father?: {
      self?: {
        prefix?: string;
        name?: string;
        suffix?: string;
      };
    };
    mother?: {
      self?: {
        prefix?: string;
        name?: string;
        suffix?: string;
      };
    };
  };
  city: string;
  birth_date: Date;
  height: number;
  cv_url?: string;
};

function parseStatus(status: string): string {
  if (status === "married") return "נשוי";
  if (status === "engaged") return "מאורס";
  if (status === "single") return "רווק";
  if (status === "divorced") return "גרוש";
  if (status === "widowed") return "אלמן";
  return status;
}

export default function Children({ childs }: { childs: Child[] }) {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [localChilds, setLocalChilds] = useState<Child[]>(childs);

  const handleIsInShidduchimChange = async (checked: boolean, id: string) => {
    const { error } = await supabase
      .from("students")
      .update({ in_shidduchim: checked })
      .eq("id", id);
    if (error) {
      toast.error("שגיאה בעדכון סטטוס השידוכים");
      return;
    }
    // rerender-functional-setstate: use functional form to avoid stale closure
    setLocalChilds((prev) =>
      prev.map((child) =>
        child.id === id ? { ...child, in_shidduchim: checked } : child,
      ),
    );
  };

  return (
    <>
      {childs.length > 0 ? (
        <>
          {/* כרטיסים — מובייל */}
          <div className="flex flex-col gap-3 pt-4 md:hidden">
            {localChilds.map((child, index) => (
              <Box key={index} className="flex flex-col gap-3 p-4">
                <span className="font-semibold">
                  {child.first_name} {child.last_name}
                </span>
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-sm">פעיל בשידוכים?</span>
                  <Switch
                    checked={child.in_shidduchim || false}
                    onCheckedChange={(e) => handleIsInShidduchimChange(e, child.id)}
                  />
                </div>
                <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-sm">
                  <span>{parseStatus(child.personal_status)}</span>
                  <span>גיל {calculateAge(child.birth_date || "")}</span>
                  {child.city && <span>{child.city}</span>}
                  {child.height && <span>{child.height} ס״מ</span>}
                </div>
                <div className="flex gap-2">
                  {child.cv_url ? (
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <a href={child.cv_url} target="_blank" rel="noopener noreferrer">
                        קו״ח
                      </a>
                    </Button>
                  ) : (
                    <Button asChild variant="outline" size="sm" className="flex-1 bg-amber-100">
                      <Link href={"/" as any}>הוספת קו״ח</Link>
                    </Button>
                  )}
                  <Button asChild size="sm" className="flex-1">
                    <Link href={`/app/students/${child.id}` as Route}>כרטיס מלא</Link>
                  </Button>
                </div>
              </Box>
            ))}
          </div>

          {/* טבלה — דסקטופ */}
          <div className="hidden md:grid md:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_3fr] md:gap-4 md:pt-4">
            <div
              data-slot="table-header"
              className="col-span-full grid grid-cols-subgrid"
            >
              <div>בשידוכים</div>
              <div>סטטוס</div>
              <div>שם משפחה</div>
              <div>שם פרטי</div>
              <div>שם האב</div>
              <div>שם האם</div>
              <div>עיר</div>
              <div>גיל</div>
              <div>גובה</div>
            </div>
            {localChilds.map((child, index) => (
              <Box
                key={index}
                className="col-span-full grid grid-cols-subgrid items-center p-4"
              >
                <div>
                  <Switch
                    checked={child.in_shidduchim || false}
                    onCheckedChange={(e) => handleIsInShidduchimChange(e, child.id)}
                  />
                </div>
                <div>{parseStatus(child.personal_status)}</div>
                <div>{child.last_name}</div>
                <div>{child.first_name}</div>
                <div>
                  {child.parents_info?.father?.self?.prefix || ""}{" "}
                  {child.parents_info?.father?.self?.name || ""}
                </div>
                <div>
                  {child.parents_info?.mother?.self?.prefix || ""}{" "}
                  {child.parents_info?.mother?.self?.name || ""}
                </div>
                <div>{child.city}</div>
                <div>{calculateAge(child.birth_date || "")}</div>
                <div>{child.height}</div>
                <div className="flex gap-1">
                  {child.cv_url ? (
                    <Button asChild className="flex-1" variant={"outline"}>
                      <a href={child.cv_url} target="_blank" rel="noopener noreferrer">
                        כרטיס קו״ח
                      </a>
                    </Button>
                  ) : (
                    <Button asChild className="flex-1 bg-amber-100" variant={"outline"}>
                      <Link href={"/" as any}>להוספת קו״ח</Link>
                    </Button>
                  )}
                  <Button asChild className="flex-1">
                    <Link href={`/app/students/${child.id}` as Route}>
                      לצפיה בכרטיס המלא
                    </Link>
                  </Button>
                </div>
              </Box>
            ))}
          </div>
        </>

      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>
              לא ידוע לנו על ילדים בגיל שידוכים במשפחה שלך
            </EmptyTitle>
            <EmptyDescription>
              טעות שלנו? אוי ווי! באפשרותך להוסיף ילדים בשידוכים מגיל 17 ומעלה
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/app/students/create">
                <User />
                להוספת בן / בת
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </>
  );
}
