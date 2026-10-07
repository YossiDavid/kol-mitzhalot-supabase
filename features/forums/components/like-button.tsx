"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LikeTarget = { postId: string } | { replyId: string };

/** לייק לפוסט או לתגובה. עדכון מיידי בממשק, וחזרה למצב הקודם אם השרת דחה. */
export default function ForumLikeButton({
  target,
  initialCount,
  initialLiked,
}: {
  target: LikeTarget;
  initialCount: number;
  initialLiked: boolean;
}) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [isPending, setIsPending] = useState(false);

  async function toggle() {
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setCount((value) => value + (nextLiked ? 1 : -1));
    setIsPending(true);
    try {
      const res = await fetch("/api/v1/forum/likes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...target, liked: nextLiked }),
      });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch {
      setIsLiked(!nextLiked);
      setCount((value) => value + (nextLiked ? -1 : 1));
      toast.error("לא הצלחנו לשמור את הלייק, נסו שוב");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggle}
      disabled={isPending}
      aria-pressed={isLiked}
      aria-label={isLiked ? "ביטול לייק" : "לייק"}
      className={cn(isLiked && "text-primary")}
    >
      <Heart className={cn("size-4", isLiked && "fill-current")} aria-hidden />
      <span>{count}</span>
    </Button>
  );
}
