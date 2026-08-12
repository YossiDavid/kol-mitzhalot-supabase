# הגדרת Magic Link (קישור התחברות במייל)

---

## אם הכפתור במייל מפנה ל‑localhost כשנכנסים מ‑production

זה קורה כאשר **Site URL** ב‑Supabase מוגדר ל‑`http://localhost:3000`. הקישור במייל נבנה מ‑`{{ .SiteURL }}` בתבנית, ולכן **חייבים** לעדכן את ההגדרה ב‑Supabase:

1. **Supabase Dashboard** → הפרויקט → **Authentication** → **URL Configuration**
2. בשדה **Site URL** החלף ל:
   - `https://kol-mitzhalot-supabase.vercel.app` (אם האתר חי על Vercel בלבד), או
   - `https://kol-mitzhalot.org.il` (אם מחובר דומיין מותאם)
3. ב־**Redirect URLs** וודא שיש:
   - `https://kol-mitzhalot-supabase.vercel.app/**`
   - `https://*.vercel.app/**`
   - `http://localhost:3000/**` (לפיתוח)
4. **Save**

אחרי השמירה, מיילים חדשים (Magic Link / הרשמה) יישלחו עם קישור לדומיין הנכון. מיילים שכבר נשלחו יישארו עם הקישור הישן.

---

כדי שה‑Magic Link יעבוד, **חובה** לעדכן את תבנית המייל ב‑Supabase כך שהקישור יכלול `token_hash` ו־`type`. ברירת המחדל לא שולחת אותם ל־`/auth/confirm`, ולכן תופיע השגיאה "חסרים פרמטרים לאימות".

## 1. עריכת תבנית המייל ב‑Supabase

1. היכנס ל־[Supabase Dashboard](https://supabase.com/dashboard) → הפרויקט שלך  
2. **Authentication** → **Email Templates**  
3. בחר **Magic Link**  
4. בעורך ה‑HTML, אתר את הקישור (לרוב `<a href="{{ .ConfirmationURL }}">` או דומה)  
5. **החלף** את הקישור בקישור שמפנה ישירות לאפליקציה עם `token_hash` ו־`type`:

### קישור להחלפה (העתק את השורה המתאימה)

**פיתוח (localhost):**
```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .TokenType }}&next=/app">התחברות</a>
```

**או (בלי `next`, יש ברירת מחדל):**
```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .TokenType }}">התחברות</a>
```

### דוגמה לתבנית מלאה (Magic Link)

```html
<h2>התחברות למערכת</h2>
<p>לחץ על הקישור כדי להתחבר:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .TokenType }}&next=/app">התחברות</a></p>
<p>אם לא ביקשת קישור זה, אפשר להתעלם מהמייל.</p>
```

## 2. Site URL ב‑Supabase (חשוב: הפרודקשן)

ב־**Authentication** → **URL Configuration**:

> **אם הכפתור במייל מפנה ל‑localhost גם כששולחים מ‑production:** ב‑Supabase יש **ערך Site URL יחיד** לפרויקט. הקישורים במייל נבנים ממנו. אם הוא `http://localhost:3000`, **כל** המיילים (כולל מ‑production) יפנו ל‑localhost.  
> **פתרון:** להגדיר **Site URL** = `https://kol-mitzhalot-supabase.vercel.app` (או `https://kol-mitzhalot.org.il`).  
> **פיתוח:** כשעובדים מ‑localhost, קישורי המייל יפנו לפרודקשן. לבדיקת Magic Link: להשתמש ב‑preview ב‑Vercel, או לשנות זמנית את Site URL ל‑`http://localhost:3000` ולהחזיר אחרי הבדיקה.

ב־**Authentication** → **URL Configuration**:

- **פיתוח:** `Site URL` = `http://localhost:3000`  
- **פרודקשן:** `Site URL` = `https://kol-mitzhalot.org.il`  
- **בטא (Vercel):** אפשר להשאיר את הפרודקשן, או לעדכן לפי הדומיין (ולוודא ש‑`Redirect URLs` כולל אותו)

ב־**Redirect URLs** הוסף (אם עדיין לא):

- `http://localhost:3000/**`
- `https://kol-mitzhalot.org.il/**`
- `https://kol-mitzhalot-supabase.vercel.app/**`
- `https://*.vercel.app/**`

## 3. איך זה עובד אחרי העדכון

1. המשתמש מקבל מייל עם קישור מהצורה:  
   `{{ SiteURL }}/auth/confirm?token_hash=...&type=magiclink&next=/app`
2. בליצה, הדפדפן נכנס ל־`/auth/confirm` עם `token_hash` ו־`type`.
3. ה־route `auth/confirm` קורא ל־`verifyOtp`, ומפנה ל־`/app` (או ל־`next` אם צוין).

## 4. אם אחרי העדכון עדיין לא עובד

- וודא ש‑`Site URL` תואם את הדומיין שבו האפליקציה רצה (localhost / דומיין חי).  
- בדוק ב‑**Email Templates** שלא נשאר קישור ישן (למשל `{{ .ConfirmationURL }}`) שמעקף את `token_hash` ו־`type`.  
- וודא ש‑`/auth/confirm` נמצא ב־Redirect URLs (או תחת `/**` שכבר מופיע).
