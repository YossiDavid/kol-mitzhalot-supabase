"use client";

import { useRef, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createReply } from "../../actions";

export function ReplyForm({
  postId,
  categorySlug,
}: {
  postId: string;
  categorySlug: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await createReply(postId, categorySlug, formData);
      ref.current?.reset();
    });
  }

  return (
    <form ref={ref} action={handleSubmit} className="space-y-3">
      <Textarea
        name="content"
        placeholder="כתוב תגובה..."
        rows={4}
        required
        disabled={isPending}
      />
      <Button type="submit" disabled={isPending}>
        {isPending ? "שולח..." : "פרסם תגובה"}
      </Button>
    </form>
  );
}
