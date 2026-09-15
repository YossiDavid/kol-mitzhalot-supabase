"use client";

import { useState } from "react";
import { FileUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DOCUMENT_ACCEPT } from "@/features/students/components/create-form/fields-data/shared-options";
import Upload from "@/features/students/components/create-form/fields/upload";
import {
  CV_MAX_SIZE_LABEL,
  validateCvFile,
} from "@/features/students/lib/cv-file-rules";

type AddCvDialogProps = {
  studentId: string;
  studentName: string;
  onCvAdded: (cvUrl: string) => void;
  triggerClassName?: string;
};

async function readErrorMessage(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  if (body && typeof body === "object" && "error" in body) {
    const { error } = body as { error: unknown };
    if (typeof error === "string" && error) return error;
  }
  return "העלאת הקובץ נכשלה";
}

/** הוספת קו״ח לכרטיס מתוך טבלת המיועדים: בחירת קובץ ושמירה בלי לעזוב את הטבלה */
export function AddCvDialog({
  studentId,
  studentName,
  onCvAdded,
  triggerClassName,
}: AddCvDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleOpenChange = (nextIsOpen: boolean) => {
    if (isUploading) return;
    setIsOpen(nextIsOpen);
    if (!nextIsOpen) {
      setFile(null);
      setFileError(null);
    }
  };

  const handleFilesChange = (files: File[]) => {
    const next = files[0] ?? null;
    const error = next ? validateCvFile(next) : null;
    setFileError(error);
    setFile(error ? null : next);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`/api/v1/students/${studentId}/cv`, {
        method: "POST",
        body,
      });
      if (!response.ok) {
        toast.error(await readErrorMessage(response));
        return;
      }
      const { cvUrl } = (await response.json()) as { cvUrl: string };
      toast.success("קובץ הקו״ח נשמר");
      onCvAdded(cvUrl);
      setIsOpen(false);
      setFile(null);
    } catch (error) {
      console.error("[students/cv] upload request failed:", error);
      toast.error("העלאת הקובץ נכשלה. בדקו את החיבור ונסו שוב.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={triggerClassName}>
          <FileUp aria-hidden />
          הוספת קו״ח
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>הוספת קו״ח</DialogTitle>
          <DialogDescription>
            קובץ קורות החיים של <strong>{studentName}</strong>. PDF או תמונה
            (PNG, JPG), עד {CV_MAX_SIZE_LABEL}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Upload
            multiple={false}
            accept={DOCUMENT_ACCEPT}
            value={file ? [file] : []}
            onChange={handleFilesChange}
            aria-invalid={Boolean(fileError)}
          />
          {fileError && (
            <p role="alert" className="text-body-sm text-destructive">
              {fileError}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isUploading}
          >
            ביטול
          </Button>
          <Button onClick={handleUpload} disabled={!file || isUploading}>
            {isUploading ? "מעלה..." : "שמירת הקובץ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
