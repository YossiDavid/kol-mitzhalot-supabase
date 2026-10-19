"use client";

import { useEffect, useState } from "react";
import { Archive, ArchiveRestore, Eye, Mail } from "lucide-react";
import { toast } from "sonner";

import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShidduchIdeaDetails } from "@/features/admin/components/submission-shidduch-details";
import { SubmissionReplyForm } from "@/features/admin/components/submission-reply-form";
import { SubmissionReplyHistory } from "@/features/admin/components/submission-reply-history";
import {
  STATUS_LABEL,
  TYPE_LABEL,
  type Submission,
  type SubmissionReply,
  type SubmissionStatus,
} from "@/features/contact-submissions/lib/submission-model";
import { createClient } from "@/lib/supabase/client";

export const STATUS_BADGE_VARIANT: Record<SubmissionStatus, BadgeVariant> = {
  new: "success",
  read: "info",
  replied: "outline",
  archived: "neutral",
};

type SubmissionDetailProps = {
  submission: Submission;
  onSetStatus: (id: string, status: SubmissionStatus) => void;
  /** אחרי מענה: הפנייה עברה ל"נענה" בשרת - הדף מרענן את הרשימה */
  onReplied: (id: string) => void;
};

/** התשובות לפנייה (RLS: מנהלים בלבד), מהישנה לחדשה */
function useSubmissionReplies(submissionId: string) {
  const [replies, setReplies] = useState<SubmissionReply[]>([]);

  useEffect(() => {
    let isCancelled = false;
    createClient()
      .from("contact_submission_replies")
      .select("*")
      .eq("submission_id", submissionId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (isCancelled) return;
        if (error) toast.error("שגיאה בטעינת התשובות");
        setReplies((data as SubmissionReply[] | null) ?? []);
      });
    return () => {
      isCancelled = true;
    };
  }, [submissionId]);

  const append = (reply: SubmissionReply) =>
    setReplies((current) => [...current, reply]);
  return { replies, append };
}

/** חלון הפנייה: פרטים, פעולות סטטוס, מייל ישיר, היסטוריית תשובות ומענה */
export function SubmissionDetail({
  submission,
  onSetStatus,
  onReplied,
}: SubmissionDetailProps) {
  const { replies, append } = useSubmissionReplies(submission.id);
  const isArchived = submission.status === "archived";

  return (
    <div className="space-y-4" data-testid="submission-detail">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSetStatus(submission.id, "read")}
        >
          <Eye className="me-1 h-4 w-4" />
          סמן כנקרא
        </Button>
        {isArchived ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onSetStatus(submission.id, replies.length ? "replied" : "read")
            }
          >
            <ArchiveRestore className="me-1 h-4 w-4" />
            החזרה מהארכיון
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSetStatus(submission.id, "archived")}
          >
            <Archive className="me-1 h-4 w-4" />
            לארכיון
          </Button>
        )}
        <Button size="sm" variant="outline" asChild>
          <a href={`mailto:${submission.email}`}>
            <Mail className="me-1 h-4 w-4" />
            מייל
          </a>
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-subtitle font-bold">{submission.name}</p>
        <Badge variant={STATUS_BADGE_VARIANT[submission.status]}>
          {STATUS_LABEL[submission.status]}
        </Badge>
      </div>
      <p className="text-body-sm text-muted-foreground">
        {submission.email}
        {submission.phone ? ` · ${submission.phone}` : ""}
      </p>
      <p className="text-body-sm font-semibold">
        {TYPE_LABEL[submission.type]}
        {submission.subject ? ` — ${submission.subject}` : ""}
      </p>
      {submission.message ? (
        <p className="text-body leading-relaxed whitespace-pre-wrap">
          {submission.message}
        </p>
      ) : null}
      {submission.type === "shidduch_idea" && submission.payload ? (
        <ShidduchIdeaDetails
          payload={submission.payload}
          message={submission.message}
        />
      ) : null}
      <SubmissionReplyHistory replies={replies} />
      <SubmissionReplyForm
        submissionId={submission.id}
        recipientEmail={submission.email}
        onReplied={(reply) => {
          append(reply);
          onReplied(submission.id);
        }}
      />
    </div>
  );
}
