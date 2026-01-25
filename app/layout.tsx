import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import { getAppOrigin } from "@/lib/app-url";
import "./globals.css";

const ploni = localFont({
  src: [
    { path: "../assets/fonts/ploni-regular-aaa.woff2", weight: "400" },
    { path: "../assets/fonts/ploni-bold-aaa.woff2", weight: "700" },
  ],
  variable: "--font-ploni",
  fallback: ["sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getAppOrigin()),
  title: "קול מצהלות",
  description: "המערכת הגדולה לניהול שידוכים במגזר החסידי",
};

const heeboSans = Heebo({
  variable: "--font-heebo-sans",
  display: "swap",
  subsets: ["latin"],
  fallback: ["sans-serif"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <body className={`${ploni.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
