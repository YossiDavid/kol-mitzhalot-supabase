import * as React from "react";

import { Card, CardTitle } from "@/components/ui/card";

export type SectionIcon = React.ComponentType<{
  size?: number;
  className?: string;
}>;

/**
 * מקטע בכרטיס המיועד: מתכון ה-`Card` המשותף עם שורת כותרת ואייקון.
 * החליף את רכיב ה-`Section` המקומי של הדף, שהיה `Box` עם `text-title!`.
 */
export function CardSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: SectionIcon;
  children: React.ReactNode;
}) {
  return (
    <Card asChild size="sm">
      <section>
        <div className="flex items-center gap-3 border-b border-border pb-3">
          <div className="rounded-lg bg-muted p-2">
            <Icon size={20} className="text-primary" />
          </div>
          <CardTitle asChild>
            <h2>{title}</h2>
          </CardTitle>
        </div>
        {children}
      </section>
    </Card>
  );
}
