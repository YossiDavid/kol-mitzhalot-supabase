"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import ProposalResponseForm from "@/features/shidduchim/components/proposal-response-form";
import type {
  ShidduchResponse,
  ShidduchSide,
} from "@/features/shidduchim/lib/responses";

type ProposalResponseDialogProps = {
  shidduchId: string;
  side: ShidduchSide;
  title: string;
  currentResponse: ShidduchResponse | null;
  currentMessage: string | null;
};

/** תגובה מהירה מתוך רשימת ההצעות - אותו טופס כמו בכרטיס השידוך */
export default function ProposalResponseDialog({
  shidduchId,
  side,
  title,
  currentResponse,
  currentMessage,
}: ProposalResponseDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">{currentResponse ? "עדכון תגובה" : "תגובה"}</Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>תגובה להצעה</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <ProposalResponseForm
          shidduchId={shidduchId}
          side={side}
          currentResponse={currentResponse}
          currentMessage={currentMessage}
          onSubmitted={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
