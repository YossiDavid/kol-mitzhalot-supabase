"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, IdCard } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import type { ContextCard } from "../lib/use-context-targets";

/**
 * "כרטיסי המשתמש": הכרטיסים של הצד השני בשיחה שאני רשאי לראות. כך שדכן
 * שנמצא בשיחה עם הורה מגיע לכרטיס של הילד. השאילתה רצה תחת ה-RLS שלי, ולכן
 * מי שאינו רשאי לראות כרטיסים מקבל רשימה ריקה.
 */
export function UserCardsMenu({ otherUserId }: { otherUserId: string }) {
  const supabase = React.useMemo(() => createClient(), []);
  const [cards, setCards] = React.useState<ContextCard[] | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    supabase
      .from("students")
      .select("id, first_name, last_name")
      .eq("user_id", otherUserId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!isMounted) return;
        setCards(
          error
            ? []
            : (data ?? []).map((row) => ({
                id: row.id,
                name:
                  `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() ||
                  "כרטיס",
              })),
        );
      });
    return () => {
      isMounted = false;
    };
  }, [otherUserId, supabase]);

  if (!cards || cards.length === 0) return null;

  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <IdCard />
          כרטיסי המשתמש
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        <DropdownMenuLabel>כרטיסים ({cards.length})</DropdownMenuLabel>
        {cards.map((card) => (
          <DropdownMenuItem key={card.id} asChild>
            <Link href={`/app/students/${card.id}`}>{card.name}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
