/** ניסוח הדיאלוג: כמה מועדפים יוסרו */
export function clearFavoritesMessage(count: number): string {
  return count === 1
    ? "מיועד/ת אחד/ת יוסר/ת מהמועדפים שלך."
    : `${count} מיועדים יוסרו מהמועדפים שלך.`;
}
