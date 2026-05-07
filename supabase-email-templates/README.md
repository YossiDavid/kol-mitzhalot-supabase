# תבניות אימייל ל-Supabase

> **מיקום מעודכן:** כל תבניות האימייל (Supabase + SendGrid) מאוחדות תחת [`email-templates/`](../email-templates/) — כולל העתקים מעודכנים והסברים. התיקייה הזו נשמרת לתאימות לאחור.

# תבניות אימייל ל-Supabase

תבניות מעוצבות בהתאמה לשפה העיצובית של האתר: צבעי הלוגו והאתר (primary `#3899a3`, כהה `#254c49`), רקע `#ecf0f2`, כרטיס לבן עם צל עדין ו־radius 10px.

## שימוש

1. Supabase Dashboard → **Authentication** → **Email Templates**
2. בחר תבנית (Magic Link, Confirm signup וכו')
3. בשדה **Body** (או **Message**) הדבק את ה‑HTML מהקובץ המתאים.
4. אם יש **Subject** – עדכן גם אותו.

---

## הוספת לוגו (תמונה) למייל

### איך זה עובד

בתבנית משתמשים בתגית:

```html
<img src="כתובת-מלאה-ללוגו" alt="קול מצהלות" width="120" height="120" style="..." />
```

חשוב: **ה-`src` חייב להיות כתובת מלאה (URL)** שהדפדפן וכלי המייל יכולים לטעון. `../assets/...` או `/images/...` בלי דומיין **לא** יעבדו במייל.

### אופציה 1: מהאתר (מומלץ)

1. **תיקיית `public`** בשורש הפרויקט כבר קיימת (Next.js מגיש ממנה קבצים תחת `/`).
2. **להכניס את הלוגו כ‑PNG** ב־`public/logo-email.png`.  
   - PNG מתאים יותר מ‑SVG לרוב לקוחות המייל.  
   - אם יש לך רק `assets/images/logo.svg`, צריך לייצא/להמיר ל‑PNG (פוטושופ, Figma, או כלי אונליין).
3. **כתובת הלוגו:**
   - בפרודקשן: `https://kol-mitzhalot.org.il/logo-email.png`
   - בתבנית של Supabase אפשר להשתמש ב־**Site URL**:
     ```html
     <img src="{{ .SiteURL }}/logo-email.png" alt="קול מצהלות" width="120" height="120" />
     ```
     `{{ .SiteURL }}` יוחלף ב־Site URL שמגדירים ב־URL Configuration (למשל `https://kol-mitzhalot.org.il` או `http://localhost:3000`).

בתנאי ש־`Site URL` = `https://kol-mitzhalot.org.il` ו‑`public/logo-email.png` קיים, התבנית תציג את הלוגו.

### אופציה 2: Supabase Storage

1. Supabase Dashboard → **Storage** → bucket ציבורי (או ליצור).
2. להעלות קובץ, למשל `logo-email.png`.
3. לקחת **URL ציבורי** לקובץ (למשל `https://...supabase.co/storage/v1/object/public/.../logo-email.png`).
4. בתבנית:
   ```html
   <img src="https://פרויקט.supabase.co/storage/v1/object/public/שם- bucket/logo-email.png" alt="קול מצהלות" width="120" height="120" />
   ```

### אופציה 3: שרת/ CDN חיצוני

להעלות את הלוגו לשרת או ל‑CDN, לקבל URL ציבורי, ולהשתמש בו ב־`src` באותו אופן.

---

## בלי לוגו (בינתיים)

אם עדיין אין `logo-email.png`, אפשר למחוק מתוך התבנית את כל הבלוק:

```html
<tr>
  <td style="padding: 32px 32px 16px; text-align: center;">
    <img src="{{ .SiteURL }}/logo-email.png" ... />
  </td>
</tr>
```

שאר המייל (כותרת, כפתור, פוטר) ימשיך לעבוד.

---

## אם הלוגו לא מופיע

- לוודא שה־URL נפתח בדפדפן (העתקת `src` לשורת הכתובת).
- לוודא שהקובץ ציבורי (ללא אימות / ללא חסימות ל‑Referer).
- חלק מכלי המייל חוסמים תמונות חיצוניות – המשתמש יצטרך “לאפשר תמונות” או ללחוץ “הצג תמונות”.
- אם משתמשים ב־`{{ .SiteURL }}` – לוודא ש‑**Site URL** ב‑Supabase מוגדר נכון (פרודקשן / דומיין שבאמת serves את `public/`).

---

## קבצים בתיקייה

- **magic-link.html** – תבנית ל‑Magic Link (התחברות במייל).
- **README.md** – הקובץ הזה.
