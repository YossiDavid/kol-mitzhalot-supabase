/** מספר בלוח הבקרה. ספירה שנכשלה (null) מוצגת כ"—" ולא כ-0 */
export function DashboardCount({ count }: { count: number | null }) {
  if (count === null) {
    return (
      <>
        <span aria-hidden>—</span>
        <span className="sr-only">לא ניתן לטעון</span>
      </>
    );
  }
  return <>{count.toLocaleString("he-IL")}</>;
}
