"use client";

import Link from "next/link";
import { HeartHandshake, IdCard } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { RoomContext } from "../lib/room-context";
import { roomContextTitle } from "../lib/room-context";
import { useContextTargets } from "../lib/use-context-targets";
import { UserCardsMenu } from "./user-cards-menu";

/**
 * פס ההקשר מתחת לכותרת השיחה: על מה השיחה, וקישור ליעד. בשיחה כללית
 * שדכן/מנהל מקבל במקום זאת תפריט "כרטיסי המשתמש". יעד שנמחק מוצג כתווית
 * בלי קישור.
 */
export function RoomContextBar({
  context,
  otherUserId,
  isStaffViewer,
}: {
  context: RoomContext;
  otherUserId: string;
  isStaffViewer: boolean;
}) {
  const targets = useContextTargets(context);

  if (context.kind === "general") {
    if (!isStaffViewer) return null;
    return (
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 md:px-4">
        <UserCardsMenu otherUserId={otherUserId} />
      </div>
    );
  }

  const Icon = context.kind === "shidduch" ? HeartHandshake : IdCard;
  const title = roomContextTitle(context);
  const proposalId =
    context.kind === "shidduch" && targets.hasProposal
      ? context.shidduchId
      : null;
  const isRemoved =
    targets.isLoaded &&
    (context.kind === "student"
      ? targets.cards.length === 0
      : !targets.hasProposal);

  return (
    <div
      data-testid="room-context-bar"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-muted/40 px-3 py-2 text-body-sm md:px-4"
    >
      <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
      {proposalId ? (
        <Link
          href={`/app/shidduchim/${proposalId}`}
          className="font-semibold text-primary hover:underline"
        >
          {title}
        </Link>
      ) : (
        <span className="font-semibold text-foreground">{title}</span>
      )}

      {context.kind === "student" &&
        targets.cards.map((card) => (
          <Button key={card.id} asChild variant="link" className="h-auto p-0">
            <Link href={`/app/students/${card.id}`}>לכרטיס</Link>
          </Button>
        ))}

      {context.kind === "shidduch" &&
        targets.cards.map((card) => (
          <Button key={card.id} asChild variant="link" className="h-auto p-0">
            <Link href={`/app/students/${card.id}`}>כרטיס {card.name}</Link>
          </Button>
        ))}

      {isRemoved && (
        <span className="text-caption text-muted-foreground">
          {context.kind === "student"
            ? "הכרטיס הוסר מהמערכת"
            : "ההצעה הוסרה מהמערכת"}
        </span>
      )}
    </div>
  );
}
