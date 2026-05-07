"use client";
import { useState } from "react";
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

export default function Children({ childs }: { childs: Child[] }) {
  const supabase = createClient();

  const [localChilds, setLocalChilds] = useState<Child[]>(childs);

  const parseStatus = (status: Child["personal_status"]) => {
    if (status === "married") return "נשוי";
    if (status === "engaged") return "מאורס";
    if (status === "single") return "רווק";
    if (status === "divorced") return "גרוש";
    if (status === "widowed") return "אלמן";
  };

  const handleIsInShidduchimChange = async (e: boolean, id: string) => {
    const { data, error } = await supabase
      .from("students")
      .update({ in_shidduchim: e })
      .eq("id", id);
    if (error) {
      console.error(error);
      return;
    }
    setLocalChilds(
      localChilds.map((child) =>
        child.id === id ? { ...child, in_shidduchim: e } : child,
      ),
    );
  };

  return (
    <>
      {childs.length > 0 ? (
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_3fr] gap-4 pt-4">
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
                  onCheckedChange={(e) =>
                    handleIsInShidduchimChange(e, child.id)
                  }
                />
              </div>
              <div>{parseStatus(child.personal_status)}</div>
              <div>{child.last_name}</div>
              <div>{child.first_name}</div>
              <div>
                {child.parents_info?.father?.self?.prefix || ""}{" "}
                {child.parents_info?.father?.self?.name || ""}{" "}
                {/* {student.parents_info.father.self.suffix} */}
              </div>
              <div>
                {child.parents_info?.mother?.self?.prefix || ""}{" "}
                {child.parents_info?.mother?.self?.name || ""}{" "}
                {/* {student.parents_info.mother.self.suffix} */}
              </div>
              <div>{child.city}</div>
              <div>{calculateAge(new Date(child.birth_date || ""))}</div>
              <div>{child.height}</div>
              <div className="flex gap-1">
                {child.cv_url ? (
                  <Button asChild className="flex-1" variant={"outline"}>
                    <a
                      href={child.cv_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      כרטיס קו״ח
                    </a>
                  </Button>
                ) : (
                  <Button
                    asChild
                    className="flex-1 bg-amber-100"
                    variant={"outline"}
                  >
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
