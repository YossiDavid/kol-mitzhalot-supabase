# דומיינים ואימות

## דומיינים

- **פרודקשן:** `https://kol-mitzhalot.org.il`  
  הגדר `NEXT_PUBLIC_APP_URL=https://kol-mitzhalot.org.il` ב־Vercel (או ב־`.env`).

- **בטא / Preview (Vercel):**  
  הדומיין הוא `https://<VERCEL_URL>` (למשל `https://kol-mitzhalot-xxx.vercel.app`).  
  `VERCEL_URL` מוגדר אוטומטית ב־Vercel; אין צורך בהגדרה נוספת.

- **פיתוח מקומי:**  
  `http://localhost:3000` (ברירת מחדל כש־`NEXT_PUBLIC_APP_URL` ו־`VERCEL_URL` לא מוגדרים).

## Magic Link ו־Confirm Link

- `emailRedirectTo` ו־`redirectTo` נבנים מתוך **הדומיין שממנו נכנס הגולש** (`window.location.origin`), ולכן יתאימו ל־localhost, לדומיין הבטא או לפרודקשן.
- ברירת המחדל אחרי confirm: `/app` (ניתן לשנות עם `?next=...`).

## Supabase – URL Configuration

ב־**Supabase Dashboard → Authentication → URL Configuration**:

1. **Site URL:**  
   `https://kol-mitzhalot.org.il`

2. **Redirect URLs** (הוסף את כולם):  
   - `https://kol-mitzhalot.org.il/**`
   - `https://*.vercel.app/**`
   - `http://localhost:3000/**`

> **הערה:** קישור האימייל (confirm/magic link) נבנה לפי ה־Site URL ב־Supabase. כדי שהקישור בבטא/localhost יפנה לאותו דומיין, ייתכן שיהיה צורך בתבנית אימייל מותאמת או בהגדרת Site URL שונה לסביבות שונות.
