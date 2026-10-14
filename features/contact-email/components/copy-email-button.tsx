"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const COPIED_MESSAGE = "הכתובת הועתקה";
const COPY_FAILED_MESSAGE = "ההעתקה נכשלה. אפשר לסמן ולהעתיק ידנית";

/** גיבוי כשה-Clipboard API חסום או לא זמין (דפדפן ישן, הקשר לא מאובטח) */
function copyWithSelection(text: string): boolean {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(field);
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyWithSelection(text);
  }
}

/**
 * כפתור "העתקה" ליד כתובת האימייל בתחתית. `withToaster` לדפים שאין בהם Toaster
 * משלהם (האתר הציבורי ודפי ההתחברות); במעטפת האפליקציה כבר יש אחד.
 */
export function CopyEmailButton({
  email,
  withToaster = false,
  className,
}: {
  email: string;
  withToaster?: boolean;
  className?: string;
}) {
  const onCopy = async () => {
    if (await copyText(email)) toast.success(COPIED_MESSAGE);
    else toast.error(COPY_FAILED_MESSAGE);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void onCopy()}
        aria-label={`העתקת כתובת האימייל ${email}`}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm text-caption text-muted-foreground transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          className,
        )}
      >
        <Copy className="size-3.5" aria-hidden />
        העתקה
      </button>
      {withToaster ? (
        <Toaster richColors dir="rtl" position="top-center" />
      ) : null}
    </>
  );
}
