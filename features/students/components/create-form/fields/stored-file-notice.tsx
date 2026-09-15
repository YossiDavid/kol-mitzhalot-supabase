"use client";

import { ExternalLink, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";

// בעריכה: קובץ שכבר שמור בכרטיס (למשל קו״ח). הכתובת היא הקישור החתום שנשמר
// ב-cv_url; השמירה לא משתנה - בלי קובץ חדש נשלחת בחזרה אותה כתובת.

const STORAGE_TIMESTAMP_PREFIX = /^\d+-/;
const URL_BASE_FOR_RELATIVE_PATHS = "https://stored-file.local";

type StoredFileNoticeProps = {
  url: string;
  label: string;
  /** נבחר קובץ חדש, שיחליף את השמור בשמירה */
  isBeingReplaced: boolean;
};

/** "…/students/<id>/1712345-cv.pdf?token=…" → "cv.pdf" */
export function getStoredFileName(url: string): string {
  try {
    const { pathname } = new URL(url, URL_BASE_FOR_RELATIVE_PATHS);
    const lastSegment = decodeURIComponent(pathname.split("/").pop() ?? "");
    return lastSegment.replace(STORAGE_TIMESTAMP_PREFIX, "");
  } catch {
    return "";
  }
}

export function StoredFileNotice({
  url,
  label,
  isBeingReplaced,
}: StoredFileNoticeProps) {
  const fileName = getStoredFileName(url);

  return (
    <div
      data-slot="stored-file"
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2"
    >
      <div className="flex min-w-0 items-center gap-2">
        <FileText
          className="size-5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-body-sm font-bold">{label}</p>
          {fileName && (
            <p
              dir="ltr"
              className="truncate text-end text-caption text-muted-foreground"
            >
              {fileName}
            </p>
          )}
        </div>
      </div>
      <Button asChild variant="outline" size="sm">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink aria-hidden />
          <span>פתיחת הקובץ</span>
        </a>
      </Button>
      {isBeingReplaced && (
        <p className="w-full text-caption text-muted-foreground">
          הקובץ החדש שבחרתם יחליף אותו בשמירה.
        </p>
      )}
    </div>
  );
}
