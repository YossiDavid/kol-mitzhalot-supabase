"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { User } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  StudentsTable,
  type StudentTableRow,
} from "@/features/students/components/students-table";
import { createClient } from "@/lib/supabase/client";

export default function Children({ childs }: { childs: StudentTableRow[] }) {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [localChilds, setLocalChilds] = useState<StudentTableRow[]>(childs);

  const handleIsInShidduchimChange = async (id: string, checked: boolean) => {
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
    <StudentsTable
      preset="children"
      className="pt-4"
      caption="הילדים שלך"
      students={localChilds}
      onInShidduchimChange={handleIsInShidduchimChange}
      onCvAdded={(id, cvUrl) =>
        setLocalChilds((prev) =>
          prev.map((child) =>
            child.id === id ? { ...child, cv_url: cvUrl } : child,
          ),
        )
      }
      emptyState={
        <Empty size="compact">
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
      }
    />
  );
}
