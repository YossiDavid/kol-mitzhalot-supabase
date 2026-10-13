/** חיווי למנהל מערכת בלבד: הכרטיס הושהה על ידי ההנהלה */
export function AdminPausedBanner() {
  return (
    <p
      className="rounded-lg border border-warning bg-warning-muted px-4 py-3 text-body-sm font-bold text-warning-muted-foreground"
      data-testid="card-admin-paused-banner"
    >
      הכרטיס מושהה על ידי ההנהלה. מנהל הכרטיס אינו יכול להחזיר אותו לשידוכים.
    </p>
  );
}
