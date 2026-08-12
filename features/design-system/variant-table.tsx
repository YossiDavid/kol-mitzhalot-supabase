"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Propstar-style variant tables for the design-system showcase.
 * - VariantMatrix: two-axis grid (e.g. size × content, variant × size)
 * - VariantSwatchRow: single-axis strip — for Badge, or any variant-only component
 * - StateBlock: labeled state section (default / active / checked)
 */

export type AxisItem<T extends string = string> = {
  id: T;
  label: string;
};

export function StateBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-caption text-muted-foreground font-semibold tracking-wide uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

export function VariantMatrix<TRow extends string, TCol extends string>({
  rows,
  columns,
  renderCell,
  minCellWidth = "9rem",
  cellClassName,
}: {
  rows: AxisItem<TRow>[];
  columns: AxisItem<TCol>[];
  renderCell: (row: AxisItem<TRow>, column: AxisItem<TCol>) => React.ReactNode;
  minCellWidth?: string;
  cellClassName?: string;
}) {
  return (
    <div className="border-muted-foreground/25 overflow-x-auto rounded-xl border border-dashed">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `auto repeat(${columns.length}, minmax(${minCellWidth}, 1fr))`,
        }}
      >
        <div />
        {columns.map((col) => (
          <div
            key={col.id}
            className="border-muted-foreground/25 flex items-center justify-center border-dashed border-s px-4 py-3"
          >
            <span className="text-caption text-muted-foreground font-semibold tracking-wide uppercase">
              {col.label}
            </span>
          </div>
        ))}

        {rows.map((row) => (
          <React.Fragment key={row.id}>
            <div className="border-muted-foreground/25 flex items-center border-t border-dashed py-3 ps-4 pe-3">
              <span className="text-label text-muted-foreground font-medium whitespace-nowrap">
                {row.label}
              </span>
            </div>
            {columns.map((col) => (
              <div
                key={col.id}
                className={cn(
                  "border-muted-foreground/25 flex min-h-24 items-center justify-center border-t border-s border-dashed p-4",
                  cellClassName,
                )}
              >
                {renderCell(row, col)}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/**
 * Size columns, each split into two state sub-columns (e.g. inactive / active).
 * Header: size spans 2 cols; under it — "לא פעיל" | "פעיל".
 */
export function StateSplitMatrix<
  TRow extends string,
  TCol extends string,
  TState extends string = "off" | "on",
>({
  rows,
  columns,
  states = [
    { id: "off" as TState, label: "לא פעיל" },
    { id: "on" as TState, label: "פעיל" },
  ],
  renderCell,
  minCellWidth = "5.5rem",
  cellClassName,
}: {
  rows: AxisItem<TRow>[];
  columns: AxisItem<TCol>[];
  states?: AxisItem<TState>[];
  renderCell: (
    row: AxisItem<TRow>,
    column: AxisItem<TCol>,
    state: AxisItem<TState>,
  ) => React.ReactNode;
  minCellWidth?: string;
  cellClassName?: string;
}) {
  const stateCount = states.length;

  return (
    <div className="border-muted-foreground/25 overflow-x-auto rounded-xl border border-dashed">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `auto repeat(${columns.length * stateCount}, minmax(${minCellWidth}, 1fr))`,
        }}
      >
        <div className="border-muted-foreground/25 border-b border-dashed" />
        {columns.map((col) => (
          <div
            key={col.id}
            className="border-muted-foreground/25 flex items-center justify-center border-b border-s border-dashed px-2 py-2"
            style={{ gridColumn: `span ${stateCount}` }}
          >
            <span className="text-caption text-muted-foreground font-semibold tracking-wide uppercase">
              {col.label}
            </span>
          </div>
        ))}

        <div />
        {columns.map((col) =>
          states.map((state) => (
            <div
              key={`${col.id}-${state.id}`}
              className="border-muted-foreground/25 flex items-center justify-center border-dashed border-s px-2 py-2"
            >
              <span className="text-caption text-muted-foreground font-medium">
                {state.label}
              </span>
            </div>
          )),
        )}

        {rows.map((row) => (
          <React.Fragment key={row.id}>
            <div className="border-muted-foreground/25 flex items-center border-t border-dashed py-3 ps-4 pe-3">
              <span className="text-label text-muted-foreground font-medium whitespace-nowrap">
                {row.label}
              </span>
            </div>
            {columns.map((col) =>
              states.map((state) => (
                <div
                  key={`${row.id}-${col.id}-${state.id}`}
                  className={cn(
                    "border-muted-foreground/25 flex min-h-20 items-center justify-center border-t border-s border-dashed p-3",
                    cellClassName,
                  )}
                >
                  {renderCell(row, col, state)}
                </div>
              )),
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export function VariantSwatchRow<T extends string>({
  items,
  renderItem,
  minItemWidth = "7rem",
}: {
  items: AxisItem<T>[];
  renderItem: (item: AxisItem<T>) => React.ReactNode;
  minItemWidth?: string;
}) {
  return (
    <div className="border-muted-foreground/25 overflow-x-auto rounded-xl border border-dashed">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${items.length}, minmax(${minItemWidth}, 1fr))`,
        }}
      >
        {items.map((item, index) => (
          <div
            key={item.id}
            className={cn(
              "border-muted-foreground/25 flex flex-col items-center justify-center gap-3 border-dashed p-5",
              index > 0 && "border-s",
            )}
          >
            {renderItem(item)}
            <span className="text-caption text-muted-foreground font-medium">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
