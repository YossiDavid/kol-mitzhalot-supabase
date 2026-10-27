/**
 * אחרי שהודעת צ'אט נשמרה: מבקש מהשרת לשלוח לצד השני מייל (מנהלי כרטיסים
 * בלבד, עם הגבלת תדירות - ראו send-chat-message-email.ts). לא חוסם ולא מציג
 * שגיאה: ההודעה עצמה כבר נשלחה, והמייל הוא תוספת.
 */
export function notifyRecipientByEmail(roomId: string): void {
  void fetch(`/api/v1/chats/${roomId}/email-notify`, { method: "POST" })
    .then((response) => {
      if (!response.ok) {
        console.error("[chats/email] notify failed", response.status);
      }
    })
    .catch((error: unknown) => {
      console.error("[chats/email] notify request failed", error);
    });
}
