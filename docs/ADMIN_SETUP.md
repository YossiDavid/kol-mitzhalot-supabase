# הגדרת עמודי אדמין

## דרישות

על מנת שעמודי האדמין יעבדו, יש צורך להוסיף את משתנה הסביבה `SUPABASE_SERVICE_ROLE_KEY` לקובץ `.env.local`.

## הוראות התקנה

1. פתח את קובץ `.env.local` בתיקיית הפרויקט (אם הוא לא קיים, צור אותו)

2. הוסף את השורה הבאה:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

3. כדי למצוא את ה-Service Role Key:
   - היכנס ל-[Supabase Dashboard](https://supabase.com/dashboard)
   - בחר את הפרויקט שלך
   - לך ל-Settings > API
   - העתק את ה-**service_role** key (לא את ה-anon key!)
   - ⚠️ **חשוב**: ה-service_role key הוא רגיש מאוד - אל תחלוק אותו או תעלה אותו ל-Git

4. הדבק את ה-key בקובץ `.env.local`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

5. הפעל מחדש את שרת הפיתוח:
   ```bash
   npm run dev
   ```

## אזהרת אבטחה

⚠️ **חשוב מאוד**: ה-Service Role Key מעניק גישה מלאה למסד הנתונים ומעקף את כל מדיניות ה-RLS. 
- לעולם אל תחלוק את ה-key הזה
- לעולם אל תעלה אותו ל-Git (הוא כבר ב-.gitignore)
- השתמש בו רק בצד השרת (server-side) - לעולם לא ב-client-side code

## בדיקת ההתקנה

לאחר הוספת המשתנה והפעלה מחדש של השרת, תוכל לגשת ל:
- `/app/admin` - דף הבית של האדמין
- `/app/admin/shadchanim` - רשימת כל השדכנים
- `/app/admin/users` - רשימת כל המשתמשים
- `/app/admin/settings` - הגדרות מערכת

רק משתמשים עם `role === "admin"` יכולים לגשת לעמודים אלה.
