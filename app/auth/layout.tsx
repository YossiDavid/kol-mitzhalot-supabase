/**
 * Auth Layout
 * 
 * דפים תחת /auth הם ציבוריים ולא דורשים אימות.
 * Layout זה מספק עיצוב פשוט לדפי התחברות, הרשמה ואימות.
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
