import React from "react";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="prose-km shell-site py-16 text-justify md:py-20">
      {children}
    </div>
  );
}
