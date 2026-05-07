# תבניות אימייל — קול מצהלות

כל התבניות בשפה אחת: **עברית** (ממשק ותוכן).

## חלוקה לפי ספק

| תיקייה | ספק | איפה מגדירים |
|--------|-----|----------------|
| [`supabase/`](./supabase/) | **Supabase Auth** — מיילים שמופעלים ממערכת האימות (הרשמה, הזמנה, Magic Link, איפוס סיסמה וכו') | Dashboard → Authentication → Email Templates → בוחרים תבנית → מדביקים את גוף ה-HTML |
| [`sendgrid/`](./sendgrid/) | **SendGrid** — מיילים ששולחים מהאפליקציה (כרגע: הצעת שידוך למנהלי כרטיסים) | SendGrid → Dynamic Templates → יוצרים תבנית → מדביקים HTML; בשליחה מהקוד: `template_id` + `dynamic_template_data` |

---

## Supabase — רשימת קבצים

| קובץ | שם התבנית ב-Dashboard (בערך) | משתני תבנית (Go templates) |
|------|------------------------------|----------------------------|
| [`supabase/confirm-signup.html`](./supabase/confirm-signup.html) | Confirm signup | `ConfirmationURL` |
| [`supabase/invite-user.html`](./supabase/invite-user.html) | Invite user | `ConfirmationURL`, `SiteURL` |
| [`supabase/magic-link.html`](./supabase/magic-link.html) | Magic Link | `SiteURL`, `TokenHash` (והקישור הבנוי בקובץ) |
| [`supabase/confirm-email-change.html`](./supabase/confirm-email-change.html) | Change Email Address | `ConfirmationURL`, `Email`, `NewEmail` |
| [`supabase/reset-password.html`](./supabase/reset-password.html) | Reset Password | `ConfirmationURL` |
| [`supabase/confirm-reauthentication.html`](./supabase/confirm-reauthentication.html) | Reauthentication | `Token` |

בכל קובץ יש בראש **הערה בעברית** עם הסבר ושם התבנית.

**לוגו:** כתובת ה-URL של הלוגו בתוך הקבצים ניתנת להחלפה (למשל Storage ציבורי או `{{ .SiteURL }}/logo-email.png` אם תעדכנו את התבנית בהתאם).

---

## SendGrid — תבנית הצעת שידוך

| קובץ | תיאור |
|------|--------|
| [`sendgrid/shidduch-offer.html`](./sendgrid/shidduch-offer.html) | מייל HTML למנהלי כרטיס (הורים) בעת שליחת הצעת שידוך מהלוח |
| [`sendgrid/shidduch-offer.test-data.json`](./sendgrid/shidduch-offer.test-data.json) | נתוני בדיקה (שלוש סצנאות) — ראו [`shidduch-offer.test-data.README.md`](./sendgrid/shidduch-offer.test-data.README.md) |

### משתנים ל-Dynamic Template (Handlebars)

יש להעביר ב־`dynamic_template_data` (או מיפוי שדות בתבנית ב-SendGrid):

| משתנה | חובה | משמעות |
|--------|------|--------|
| `groom_name` | כן | שם מלא/תצוגה של המיועד |
| `bride_name` | כן | שם מלא/תצוגה של המיועדת |
| `shadchan_name` | כן | שם השדכן החותם |
| `note_for_groom` | לא | טקסט הערה לצד המיועד (ריק אם אין) |
| `note_for_bride` | לא | טקסט הערה לצד המיועדת (ריק אם אין) |
| `is_both` | כן | `true` כשהמייל משלב את שני הצדדים (אותו מייל לשני ההורים) |
| `is_groom_only` | כן | `true` כשהמייל מיועד רק למי שמקבל עדכון על המיועד |
| `is_bride_only` | כן | `true` כשהמייל מיועד רק למי שמקבל עדכון על המיועדת |

רק **אחד** מ־`is_both` / `is_groom_only` / `is_bride_only` צריך להיות `true` בכל שליחה.

**לוגו:** בתבנית HTML מוטמעת כתובת קבועה ללוגו (Supabase Storage ציבורי). לשינוי לוגו — עורכים את הקובץ `sendgrid/shidduch-offer.html` או מעלים קובץ חדש ל-Storage ומעדכנים את ה-`src`.

### דוגמה ל־`dynamic_template_data` (JSON)

```json
{
  "groom_name": "ישראל ישראלי",
  "bride_name": "לאה לוי",
  "shadchan_name": "משה כהן",
  "note_for_groom": "שלום, נראה התאמה טובה בתחום הלימודים.",
  "note_for_bride": "",
  "is_both": true,
  "is_groom_only": false,
  "is_bride_only": false
}
```

בשליחה לצד מיועד בלבד — למשל רק למיועד:

```json
{
  "groom_name": "ישראל ישראלי",
  "bride_name": "לאה לוי",
  "shadchan_name": "משה כהן",
  "note_for_groom": "הערה רלוונטית לצד המיועד בלבד",
  "note_for_bride": "",
  "is_both": false,
  "is_groom_only": true,
  "is_bride_only": false
}
```

**חיבור בקוד:** ב־[`lib/send-offer-email.ts`](../lib/send-offer-email.ts) — אם מוגדר `SENDGRID_TEMPLATE_ID_SHIDDUCH_OFFER` ב־`.env`, נשלחת תבנית Dynamic עם `dynamic_template_data` (שמות, הערות, דגלי `is_both` וכו'). בלי המשתנה — נשלח טקסט גולמי (גיבוי).

### צ׳קליסט לפני פרודקשן

1. [ ] SendGrid: יצירת **Dynamic Template** והדבקת [`sendgrid/shidduch-offer.html`](./sendgrid/shidduch-offer.html) בגוף התבנית.
2. [ ] SendGrid: לוודא שדות השולח (Single Sender או Domain Authentication) ומנוי **ביטול דיוור** אם נדרש.
3. [ ] Vercel / שרת: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_TEMPLATE_ID_SHIDDUCH_OFFER=d-...`
4. [ ] בדיקה: שליחת הצעה מהלוח ולבדוק קבלה במייל (HTML + נתונים).

### תחתית SendGrid (ביטול הרשמה)

בתבנית הוטמע בלוק ברירת המחדל של SendGrid עם `{{{unsubscribe}}}`, `{{{unsubscribe_preferences}}}` ושדות שולח — אלו מוחלפים על ידי SendGrid כשמפעילים Subscription Tracking / כתובת שולח מאומתת.

---

## קישור לתיקייה הישנה

תבניות ישנות יותר (חלקית) נמצאות גם ב־[`supabase-email-templates/`](../supabase-email-templates/) — המקור המאוחד לעבודה הוא **`email-templates/`** בתיקייה זו.
