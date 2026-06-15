"use client";

import { useTransition } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleLike } from "../../actions";
import { cn } from "@/lib/utils";

export function LikeButton({
  postId,
  replyId,
  count,
  liked,
}: {
  postId?: string;
  replyId?: string;
  count: number;
  liked: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await toggleLike(postId, replyId);
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "gap-1.5 text-xs",
        liked && "text-rose-500 hover:text-rose-600",
      )}
      onClick={handleClick}
      disabled={isPending}
    >
      <Heart className={cn("h-3.5 w-3.5", liked && "fill-current")} />
      {count}
    </Button>
  );
}
