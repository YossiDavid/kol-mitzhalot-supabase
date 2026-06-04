# שפה עיצובית — קול מצהלות

מסמך זה מתאר את השפה העיצובית **כפי שהיא ממומשת היום** בקוד (Tailwind v4, משתני CSS, רכיבי shadcn/ui). השימוש בו מיועד לעקביות בין מסכים חדשים לבין המערכת הקיימת.

---

## עקרונות

- **מוצר בעברית, מימין לשמאל**: `lang="he"`, `dir="rtl"` ברמת המסמך. רכיבים כמו Toaster מוגדרים עם `dir="rtl"`.
- **בסיס ניטרלי + צבע מותג**: רקעים ו־surfaces בהירים/כהים ניטרליים; ה־primary וה־sidebar נושאים גוון כחול־ירוק (teal) במצב בהיר, ובמצב כהה — primary בהיר יותר על רקע כהה.
- **רכיבי מערכת מוכרים**: [shadcn/ui](https://ui.shadcn.com) בסגנון **New York**, `baseColor: neutral`, אייקונים ב־**Lucide React**.
- **תמיכה בערכות נושא**: `next-themes` עם `attribute="class"`, ברירת מחדל `system`, ללא אנימציית מעבר בין ערכות (`disableTransitionOnChange`).

---

## טיפוגרפיה

| שימוש | מימוש |
|--------|--------|
| גוף האפליקציה | פונט מקומי **Ploni** (משקלים 400, 700), עם `antialiased` על `body` — ראו `app/layout.tsx`. |
| כותרות בסיס ב־CSS | `h1`: `text-primary`, `text-4xl`, `font-extrabold`. `h2`: `text-primary`, `text-3xl`, `font-bold` — ראו `app/globals.css` ב־`@layer base`. |
| הודעות Toast | משפחה `ploni` מוגדרת בסגנון ה־Toaster ב־`app/app/layout.tsx`. |

**הערה:** ב־`app/layout.tsx` מוגדר גם משתנה ל־Heebo (`--font-heebo-sans`) אך הוא לא מחובר כרגע ל־`className` של `body`. ב־`@theme inline` ב־`globals.css` ממופים `--font-sans` / `--font-mono` ל־Geist — אם אין טעינה של Geist, עדיף ליישר את זה לפונטים שבאמת בשימוש בעתיד.

---

## צבעים וטוקנים

הטוקנים המרכזיים מוגדרים ב־`:root` ו־`.dark` ב־`app/globals.css` וממופים ל־Tailwind תחת `@theme inline`.

| טוקן | תפקיד |
|------|--------|
| `--background` / `--foreground` | רקע דף וטקסט ראשי |
| `--card` / `--card-foreground` | כרטיסים, פאנלים |
| `--primary` / `--primary-foreground` | פעולות ראשיות, כותרות ברירת מחדל (`h1`/`h2`) |
| `--muted` / `--muted-foreground` | רקע/טקסט משני |
| `--border`, `--input`, `--ring` | גבולות, שדות, פוקוס |
| `--destructive` | מחיקות ושגיאות |
| `--sidebar-*` | סרגל צד (תואם ל־primary במצב בהיר) |
| `--favorite` | צבע ייעודי למועדפים (כתום־זהוב ב־oklch) |
| `--chart-1` … `--chart-5` | סדרות צבע לגרפים (אם יש שימוש) |

**רדיוס ברירת מחדל:** `--radius: 0.625rem` (כ־10px), עם נגזרות `sm` / `md` / `lg` / `xl` ב־theme.

---

## פריסה ומרווחים

- **מיכל (`container`)**: `margin-inline: auto`, `padding-inline: 20px` — הגדרה מותאמת ב־`@utility container` ב־`globals.css`.
- **אזור תוכן אפליקציה**: `main` עם `className="container flex-1 py-5"` ב־`app/app/layout.tsx`.
- **כותרת עליונה**: גובה קבוע `h-16`, גבול תחתון עדין `border-b border-b-foreground/10`, טקסט `font-semibold` — ראו `components/layout/header/index.tsx`.
- **רשת תוכן מותאמת**: המחלקה `.content-grid` — רשת עם `gap: 20px` ותבנית עמודות `1fr 3fr 1fr` ו־grid areas (אימוג'י כשמות אזורים) — לשימוש במסכים ספציפיים.
- **טבלאות/רשימות מורכבות**: משתני CSS `--children-cols` ו־`--favorites-cols` עם המחלקות `.children-cols` ו־`.favorites-cols` לעמודות גריד דינמיות.

---

## רכיבים ודפוסים

### כפתורים (`Button`)

וריאנטים מוגדרים ב־`components/ui/button.tsx`: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`, ו־`destructiveOutline` (מותאם לפרויקט). גדלים: `default`, `sm`, `lg`, `icon`, `icon-sm`, `icon-lg`. פוקוס: טבעת `ring` סביב `ring`, גבול פוקוס על `border-ring`.

### כרטיסים (`Card`)

`rounded-xl border bg-card shadow`, כותרת עם `font-semibold`, תיאור ב־`text-muted-foreground text-sm` — `components/ui/card.tsx`.

### תיבת תוכן (`Box`)

רכיב `components/layout/box.tsx`: משלב את המחלקה הגלובלית `.box` — `bg-card rounded-xl` + `p-4` (מ־`globals.css`).

### סרגל צד

`AppSidebar` משתמש ב־`Sidebar` עם `variant="floating"`, `side="right"`, `collapsible="icon"` — מתאים ל־RTL. צבעי הסרגל נשענים על טוקני `--sidebar-*`.

### משוב למשתמש

- **Toast**: Sonner עם `richColors`, מיקום `top-center`, כיוון RTL וסגנון כותרת מודגש — `app/app/layout.tsx`.

---

## נקודות נגישות ואינטראקציה

- כפתורים ו־`[role="button"]` שאינם `disabled` מקבלים `cursor: pointer` ב־`globals.css`.
- שדות לא תקינים: כפתורים תומכים ב־`aria-invalid` עם טבעת/גבול destructive.
- קיצור מקלדת לסרגל (בתוך רכיב הסיידבר): `Ctrl/Cmd + B`.

---

## קבצי עוגן

| נושא | קובץ |
|------|------|
| משתני צבע, רדיוס, utilities | `app/globals.css` |
| פונט גוף, ThemeProvider | `app/layout.tsx` |
| מבנה אפליקציה, Toaster | `app/app/layout.tsx` |
| הגדרת shadcn | `components.json` |
| כפתורים / כרטיסים | `components/ui/button.tsx`, `components/ui/card.tsx` |

---

## הנחיות קצרות לפיתוח חדש

1. להעדיף **טוקני theme** (`bg-background`, `text-foreground`, `border-border`, `text-primary`, וכו') על פני צבעים קשיחים.
2. לשמור על **מיכל** ועל **מרווחי אנכיים** (`py-5`) כמו בשאר האפליקציה, אלא אם יש סיבה מוצרתית אחרת.
3. לכבד **RTL**: יישור, סדר אלמנטים, ומיקום תפריטים נפתחים (`align` ב־Dropdown וכדומה).
4. לרכיבים חדשים — להרחיב את **shadcn** הקיים ואת `cn()` מ־`lib/utils.ts` לשילוב מחלקות.
