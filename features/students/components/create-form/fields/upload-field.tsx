"use client";

import type { FieldControlProps } from "./field-control-types";
import { FieldFrame } from "./field-frame";
import { ensureStringValue, isRecord, readText } from "./field-values";
import Upload from "./upload";

const MULTI_UPLOAD_SUFFIX = ".documents";
const DEFAULT_STORED_FILE_LABEL = "קובץ שמור";

/**
 * "upload". מסמכים רפואיים (…documents) הם מערך קבצים; קובץ בודד (קו״ח) הוא
 * { file, existingUrl }, ו-existingUrl הוא הקובץ שכבר שמור בעריכה.
 */
export function UploadFormField(props: FieldControlProps) {
  const { field, name } = props;
  const isMultiUpload = name.endsWith(MULTI_UPLOAD_SUFFIX);

  return (
    <FieldFrame {...props}>
      {(rhfField) => {
        const current = rhfField.value;
        const singleValue = isRecord(current) ? current : {};
        const files: File[] = isMultiUpload
          ? Array.isArray(current)
            ? (current as File[])
            : []
          : singleValue.file instanceof File
            ? [singleValue.file]
            : [];

        const handleFilesChange = (nextFiles: File[]) =>
          rhfField.onChange(
            isMultiUpload
              ? nextFiles
              : { ...singleValue, file: nextFiles[0] ?? null },
          );

        const storedUrl = isMultiUpload
          ? ""
          : ensureStringValue(singleValue.existingUrl);

        return (
          <Upload
            accept={field.accept}
            multiple={isMultiUpload}
            value={files}
            onChange={handleFilesChange}
            storedFile={
              storedUrl
                ? {
                    url: storedUrl,
                    label: readText(
                      field.storedFileLabel,
                      DEFAULT_STORED_FILE_LABEL,
                    ),
                  }
                : undefined
            }
          />
        );
      }}
    </FieldFrame>
  );
}
