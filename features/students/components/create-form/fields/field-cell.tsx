"use client";

import { Fragment, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  FIELD_SCROLL_MARGIN_CLASS,
  FULL_ROW_CLASS,
  fieldCellAttributes,
  getFieldWidthClass,
} from "../field-layout";
import type { FieldMetadata } from "./field-control-types";

const HTML_TAG_PATTERN = /<[a-z][\s\S]*>/i;

/**
 * תא של שדה ברשת, לפי הרוחב הסמנטי ומסומן בשם השדה (לגלילה לשגיאה).
 * טקסט לפני השדה (למשל "לומד עם חברותא") בשורה משלו, כדי שהשדה ושכנו
 * בשורה יתיישרו לפי התוויות.
 */
export function FieldCell({
  field,
  children,
}: {
  field: FieldMetadata;
  children: ReactNode;
}) {
  return (
    <Fragment>
      {renderBeforeField(field.beforeField ?? field.before)}
      <div
        className={cn(
          getFieldWidthClass(field.width),
          FIELD_SCROLL_MARGIN_CLASS,
        )}
        {...fieldCellAttributes(field.name)}
      >
        {children}
      </div>
    </Fragment>
  );
}

/**
 * טקסט שמופיע לפני שדה. ברשת הוא שורה מלאה משלו: HTML (פתיח הטופס) כמו
 * שהוא, וטקסט רגיל ככותרת קטנה של קבוצת השדות שאחריו.
 */
export function renderBeforeField(
  beforeField: ReactNode,
  { inGrid = true }: { inGrid?: boolean } = {},
) {
  if (!beforeField) {
    return null;
  }

  const rowClass = inGrid ? FULL_ROW_CLASS : undefined;

  if (typeof beforeField === "string" && HTML_TAG_PATTERN.test(beforeField)) {
    return (
      <div
        dangerouslySetInnerHTML={{ __html: beforeField }}
        className={cn(rowClass, "space-y-2 [&>hr]:mt-7")}
      />
    );
  }

  if (typeof beforeField === "string") {
    // קרוב לשדה שהוא מתאר: חצי מהמרווח בין שורות
    return (
      <p className={cn(rowClass, "-mb-3 text-label font-bold")}>
        {beforeField}
      </p>
    );
  }

  return <div className={rowClass}>{beforeField}</div>;
}
