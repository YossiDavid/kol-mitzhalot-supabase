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
import { ProposalLimitControl } from "@/features/dashboard/components/user/proposal-limit-control";
import type { ProposalLimitPeriod } from "@/features/students/lib/proposal-limit";

export default function Children({ childs }: { childs: StudentTableRow[] }) {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [localChilds, setLocalChilds] = useState<StudentTableRow[]>(childs);

  const handleIsInShidduchimChange = async (id: string, checked: boolean) => {
    // הערך שחוזר מהמסד הוא האמת: כרטיס שהנהלה השהתה נשאר false גם אם
    // נשלח true (הטריגר enforce_student_admin_pause)
    const { data, error } = await supabase
      .from("students")
      .update({ in_shidduchim: checked })
      .eq("id", id)
      .select("in_shidduchim")
      .single();
    if (error || !data) {
      toast.error("שגיאה בעדכון סטטוס השידוכים");
      return;
    }
    // rerender-functional-setstate: use functional form to avoid stale closure
    setLocalChilds((prev) =>
      prev.map((child) =>
        child.id === id
          ? { ...child, in_shidduchim: data.in_shidduchim }
          : child,
      ),
    );
  };

  return (
    <StudentsTable
      preset="children"
      className="pt-4"
      caption="המיועדים שלך"
      students={localChilds}
      onInShidduchimChange={handleIsInShidduchimChange}
      renderProposalLimit={(child) => (
        <ProposalLimitControl
          studentId={child.id}
          studentName={`${child.first_name} ${child.last_name}`}
          limit={{
            count: child.proposal_limit_count ?? null,
            period: (child.proposal_limit_period ??
              null) as ProposalLimitPeriod | null,
          }}
          onChanged={(limit) =>
            setLocalChilds((prev) =>
              prev.map((row) =>
                row.id === child.id
                  ? {
                      ...row,
                      proposal_limit_count: limit.count,
                      proposal_limit_period: limit.period,
                    }
                  : row,
              ),
            )
          }
        />
      )}
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
            <EmptyTitle>עדיין לא נוסף מיועד/ת בחשבון שלך</EmptyTitle>
            <EmptyDescription>
              באפשרותך להוסיף מיועד/ת מגיל 17 ומעלה
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/app/students/create">
                <User />
                להוספת מיועד/ת
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      }
    />
  );
}
