# מבנה האימות באפליקציה

## סקירה כללית

המערכת משתמשת בגישה של **Layout-Based Authentication** - כל route group מחליט בעצמו אם הוא דורש אימות או לא.

## מבנה הדפים

### 📁 `/(website)` - דפים ציבוריים

**דרך גישה:** `/` או כל מסלול שלא מתחיל ב-`/app` או `/auth`

**דוגמאות:**
- `/` - דף בית
- `/legal/terms-of-service` - תנאי שימוש
- `/legal/privacy-policy` - מדיניות פרטיות
- `/pricing` - מחירון
- `/support` - תמיכה

**מאפיינים:**
- ✅ נגיש לכולם (גם למשתמשים לא מחוברים)
- ✅ כולל Header + Footer
- ✅ אין בדיקת אימות

**קובץ Layout:** `app/(website)/layout.tsx`

---

### 🔐 `/app` - אזור מוגן (דורש אימות)

**דרך גישה:** `/app/*`

**דוגמאות:**
- `/app` - דשבורד ראשי
- `/app/students` - רשימת תלמידים
- `/app/chats` - צ'אטים
- `/app/settings` - הגדרות
- `/app/admin` - פאנל ניהול (דורש הרשאות נוספות)

**מאפיינים:**
- 🔒 דורש התחברות - אם המשתמש לא מחובר, מופנה ל-`/auth/login`
- 🔒 דורש אימות טלפון - אם הטלפון לא אומת, מופנה ל-`/auth/verify-phone`
- ✅ כולל Sidebar + Header + Footer
- ✅ כולל Toaster להודעות

**קובץ Layout:** `app/app/layout.tsx`

**לוגיקת האימות:**
```typescript
// בדיקה 1: האם המשתמש מחובר?
if (!user) {
  redirect("/auth/login");
}

// בדיקה 2: האם הטלפון אומת?
const isPhoneVerified = user?.user_metadata?.phone_verified === true;
if (!isPhoneVerified) {
  redirect("/auth/verify-phone");
}
```

---

### 🔓 `/auth` - דפי אימות (ציבוריים)

**דרך גישה:** `/auth/*`

**דוגמאות:**
- `/auth/login` - התחברות
- `/auth/sign-up` - הרשמה
- `/auth/otp` - קוד OTP
- `/auth/forgot-password` - שכחתי סיסמה
- `/auth/verify-phone` - אימות טלפון
- `/auth/update-password` - עדכון סיסמה

**מאפיינים:**
- ✅ נגיש לכולם
- ✅ עיצוב פשוט וממורכז
- ✅ אין בדיקת אימות

**קובץ Layout:** `app/auth/layout.tsx`

---

## Proxy (Next.js 15+)

**קבצים:** 
- `proxy.ts` - נקודת הכניסה
- `lib/supabase/proxy.ts` - הלוגיקה

**תפקיד:**
- ✅ מנהל את הסשן של Supabase
- ✅ מעדכן cookies
- ❌ **לא** מבצע הפניות (redirects)
- ❌ **לא** בודק אימות

**למה לא בודק אימות?**
כדי לאפשר שליטה גמישה - כל layout מחליט בעצמו אם הוא דורש אימות.

**הערה:** Next.js 15 החליף את `middleware.ts` ב-`proxy.ts`.

---

## איך להוסיף דף חדש?

### דף ציבורי חדש
1. צור את הדף ב-`app/(website)/your-page/page.tsx`
2. הדף יהיה נגיש לכולם אוטומטית

### דף מוגן חדש
1. צור את הדף ב-`app/app/your-page/page.tsx`
2. הדף ידרוש אימות אוטומטית (דרך ה-layout)

### דף אימות חדש
1. צור את הדף ב-`app/auth/your-page/page.tsx`
2. הדף יהיה נגיש לכולם אוטומטית

---

## איך להוסיף route group חדש עם הגנה מותאמת אישית?

אם אתה רוצה route group חדש עם לוגיקת אימות שונה:

1. צור route group: `app/(your-group)/`
2. צור layout: `app/(your-group)/layout.tsx`
3. הוסף את לוגיקת האימות שלך ב-layout:

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function YourGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // הוסף את הבדיקות שלך כאן
  if (!user) {
    redirect("/auth/login");
  }

  // בדיקות נוספות...
  // if (!hasPermission) {
  //   redirect("/no-access");
  // }

  return <div>{children}</div>;
}
```

---

## סיכום

| Route Group | נגיש ללא אימות? | Layout | בדיקות |
|------------|-----------------|--------|---------|
| `/(website)` | ✅ כן | `app/(website)/layout.tsx` | אין |
| `/app` | ❌ לא | `app/app/layout.tsx` | אימות + טלפון |
| `/auth` | ✅ כן | `app/auth/layout.tsx` | אין |
| `/api` | תלוי ביישום | אין | לפי endpoint |

---

## קבצים חשובים

- ✅ `proxy.ts` - נקודת הכניסה ל-proxy
- ✅ `lib/supabase/proxy.ts` - ניהול סשן Supabase
- ✅ `app/app/layout.tsx` - הגנה על דפים מוגנים
- ✅ `app/(website)/layout.tsx` - דפים ציבוריים
- ✅ `app/auth/layout.tsx` - דפי אימות
