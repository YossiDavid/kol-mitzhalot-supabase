"use client";

import type { Route } from "next";
import type { ReactNode } from "react";

import { TableRow } from "@/components/ui/table";
import { useRowLink } from "./use-row-link";

type LinkedRowProps = {
  href: Route;
  /** שם נגיש לשורה, למשל "כרטיס מלא: ישראל ישראלי" */
  label: string;
  className?: string;
  children: ReactNode;
};

/**
 * שורת טבלה שכולה קישור. זה הרכיב היחיד ב-DataTable שדורש צד לקוח, כך
 * שעמוד שרת שמציג טבלה עם קישורי שורה נשאר רכיב שרת.
 */
export function LinkedTableRow({
  href,
  label,
  className,
  children,
}: LinkedRowProps) {
  const getRowLinkProps = useRowLink();
  return (
    // role נשאר row: role="group" של הקישור היה מוציא את השורה ממבנה הטבלה
    <TableRow
      {...getRowLinkProps(href, label)}
      role={undefined}
      className={className}
    >
      {children}
    </TableRow>
  );
}

/** כרטיס מובייל שכולו קישור - אותה התנהגות כמו LinkedTableRow */
export function LinkedCard({
  href,
  label,
  className,
  children,
}: LinkedRowProps) {
  const getRowLinkProps = useRowLink();
  return (
    <div {...getRowLinkProps(href, label)} className={className}>
      {children}
    </div>
  );
}
