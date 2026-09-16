/**
 * הודעת התקנה כשחסר SUPABASE_SERVICE_ROLE_KEY (או כשל אחר של ה-admin client)
 * בעמודי הניהול שנשענים עליו.
 */
export function ServiceRoleError({ message }: { message: string }) {
  const isServiceRoleKeyError = message.includes("SUPABASE_SERVICE_ROLE_KEY");

  return (
    <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
      <h3 className="mb-2 text-subtitle font-semibold text-destructive">
        שגיאה בהגדרת האדמין
      </h3>
      {isServiceRoleKeyError ? (
        <div className="space-y-4">
          <p className="text-body-sm">
            המשתנה{" "}
            <code className="rounded bg-muted px-2 py-1">
              SUPABASE_SERVICE_ROLE_KEY
            </code>{" "}
            לא מוגדר.
          </p>
          <div className="space-y-2 rounded-lg bg-muted p-4">
            <p className="font-semibold">הוראות התקנה:</p>
            <ol className="list-inside list-decimal space-y-1 text-body-sm">
              <li>
                פתח את קובץ{" "}
                <code className="rounded bg-background px-1">.env.local</code>{" "}
                בתיקיית הפרויקט
              </li>
              <li>
                הוסף את השורה:{" "}
                <code className="rounded bg-background px-1">
                  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
                </code>
              </li>
              <li>
                מצא את ה-Service Role Key ב-{" "}
                <a
                  href="https://supabase.com/dashboard/project/_/settings/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Supabase Dashboard → Settings → API
                </a>
              </li>
              <li>
                הפעל מחדש את שרת הפיתוח (
                <code className="rounded bg-background px-1">npm run dev</code>)
              </li>
            </ol>
          </div>
          <p className="text-caption text-muted-foreground">
            ⚠️ ה-Service Role Key רגיש מאוד - אל תחלוק אותו או תעלה אותו ל-Git
          </p>
        </div>
      ) : (
        <p className="text-body-sm">{message}</p>
      )}
    </div>
  );
}
