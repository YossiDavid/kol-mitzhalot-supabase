"use client";

import Link from "next/link";
import type { Route } from "next";
import { HeartHandshake, IdCard } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { RoomContext } from "../lib/room-context";
import { roomContextTitle } from "../lib/room-context";
import { useContextTargets } from "../lib/use-context-targets";
import { UserCardsMenu } from "./user-cards-menu";

const BAR_CLASS =
  "flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-muted/40 px-3 py-2 text-body-sm md:px-4";

/** כפתור קישור בולט בפס ההקשר; הטקסט נחתך בשם ארוך כדי שלא ידחוף במובייל */
function ContextLinkButton({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: typeof IdCard;
  children: React.ReactNode;
}) {
  return (
    <Button asChild variant="outline" size="sm" className="max-w-full">
      <Link href={href as Route}>
        <Icon aria-hidden="true" />
        <span className="truncate">{children}</span>
      </Link>
    </Button>
  );
}

/**
 * פס ההקשר מתחת לכותרת השיחה: על מה השיחה, וכפתורים ליעד (הכרטיס וההצעה).
 * בשיחה כללית שדכן/מנהל מקבל במקום זאת תפריט "כרטיסי המשתמש". יעד שנמחק
 * מוצג כתווית בלי קישור.
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
      <div data-testid="room-context-bar" className={BAR_CLASS}>
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
    <div data-testid="room-context-bar" className={BAR_CLASS}>
      <span className="flex min-w-0 items-center gap-2">
        <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
        <span className="truncate font-semibold text-foreground">{title}</span>
      </span>

      {proposalId && (
        <ContextLinkButton
          href={`/app/shidduchim/${proposalId}`}
          icon={HeartHandshake}
        >
          להצעה
        </ContextLinkButton>
      )}

      {targets.cards.map((card) => (
        <ContextLinkButton
          key={card.id}
          href={`/app/students/${card.id}`}
          icon={IdCard}
        >
          לכרטיס של {card.name}
        </ContextLinkButton>
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
