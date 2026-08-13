import React from "react";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="prose-km mx-auto max-w-[1000px] py-8 text-justify">
      {children}
    </div>
  );
}
