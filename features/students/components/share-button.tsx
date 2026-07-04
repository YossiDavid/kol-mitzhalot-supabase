"use client";
import { Button } from "@/components/ui/button";
import { Share2, Check } from "lucide-react";
import { useState } from "react";

interface ShareButtonProps {
  studentId: string;
  studentName?: string;
}

export default function ShareButton({ studentId, studentName }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}/app/students/${studentId}`;
    const title = studentName ? `כרטיס שידוכים — ${studentName}` : "כרטיס שידוכים";

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // user cancelled or API not supported — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // last resort — open in new tab so user can copy manually
      window.open(url, "_blank");
    }
  };

  return (
    <Button variant="outline" onClick={handleShare}>
      {copied ? (
        <>
          <Check className="h-4 w-4 text-green-600" />
          הקישור הועתק
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" />
          שיתוף הכרטיס
        </>
      )}
    </Button>
  );
}
