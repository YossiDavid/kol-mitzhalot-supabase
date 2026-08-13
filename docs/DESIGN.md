# שפה עיצובית — קול מצהלות

מסמך זה מתאר את השפה העיצובית **כפי שהיא ממומשת היום** בקוד (Tailwind v4, משתני CSS, רכיבי shadcn/ui). השימוש בו מיועד לעקביות בין מסכים חדשים לבין המערכת הקיימת.

**מקור האמת ל־CSS של ה־Design System:** [`app/design-system.css`](../app/design-system.css) — צבעים, טיפוגרפיה, רדיוס, fonts, light/dark. `globals.css` רק מייבא אותו ומוסיף utilities ספציפיים לאפליקציה.

---

## עקרונות

- **מוצר בעברית, מימין לשמאל**: `lang="he"`, `dir="rtl"` ברמת המסמך. רכיבים כמו Toaster מוגדרים עם `dir="rtl"`.
- **בסיס ניטרלי + צבע מותג**: רקעים ו־surfaces בהירים/כהים ניטרליים; ה־primary וה־sidebar נושאים גוון כחול־ירוק (teal) במצב בהיר, ובמצב כהה — primary בהיר יותר על רקע כהה.
- **רכיבי מערכת מוכרים**: [shadcn/ui](https://ui.shadcn.com) בסגנון **New York**, `baseColor: neutral`, אייקונים ב־**Lucide React**.
- **תמיכה בערכות נושא**: `next-themes` עם `attribute="class"`, ברירת מחדל `system`, ללא אנימציית מעבר בין ערכות (`disableTransitionOnChange`).

---

## טיפוגרפיה

| טוקן | מחלקה | גודל | שימוש |
|------|--------|------|--------|
| display | `text-display` | 2.75rem (44px) | כותרת עמוד (h1) |
| heading | `text-heading` | 2.25rem (36px) | כותרת מקטע (h2) |
| title | `text-title` | 1.75rem (28px) | כותרת משנית (h3) |
| subtitle | `text-subtitle` | 1.375rem (22px) | כותרת קטנה / כרטיס |
| body | `text-body` | 1.125rem (18px) | טקסט גוף |
| body-sm | `text-body-sm` | 1rem (16px) | טקסט משני |
| label | `text-label` | 1rem (16px) | תוויות שדות |
| caption | `text-caption` | 0.875rem (14px) | הערות / מטא |

- **פונט:** Ploni (400, 700) דרך `app/layout.tsx` — `--font-ploni` ממופה ל־`--font-sans`.
- **Showcase חי (dev בלבד):** `/dev/design-system` — נחסם ב־`proxy.ts` וב־`notFound()` מחוץ ל־`NODE_ENV=development`.
- **קטלוג טוקנים:** `lib/design-system/tokens.ts`

### חוזה טיפוגרפיה (מניעת drift)

**מקור אמת יחיד:** משתני `--text-*` ב־[`app/design-system.css`](../app/design-system.css). אין להגדיר גודל פונט במקום אחר.

**איך לכתוב מסכים חדשים:**

1. העדיפו HTML סמנטי — `h1`–`h6`, `p`, `small` מקבלים גודל אוטומטית מ־`@layer base`.
2. ברכיבי UI (Button, Card, Label, Input…) הגודל כבר מוגדר ברכיב — אל תדרסו עם מחלקת גודל.
3. לתוכן ארוך (מאמרים, legal, בלוקי שיווק עם פסקאות) — עטפו ב־`prose-km` (מוגדר ב־`app/design-system.css`; דוגמה: `app/(website)/legal`).
4. כשחייבים מחלקה מפורשת — רק: `text-display` | `text-heading` | `text-title` | `text-subtitle` | `text-body` | `text-body-sm` | `text-label` | `text-caption`.
5. גרדיאנטים / שטיפות שיווקיות: `bg-brand-gold-gradient` / `bg-primary-gradient` / `bg-primary-stripe*` / `bg-primary-wash` / `shadow-primary-cta` — לא hex או `rgba(43,90,92,…)` קשיח.

**אסור:**

- `text-xs` / `text-sm` / `text-base` / `text-lg` / `text-xl` / `text-2xl`…
- `text-[15px]` או כל גודל arbitrary
- `style={{ fontSize: … }}` / `clamp(...)` לפונט

ESLint (`no-restricted-syntax` ב־`eslint.config.mjs`) אוכף את החוזה.

**בסיס CSS:** `h1` → display, `h2` → heading, `h3` → title, `h4` → subtitle, `h5` → label, `h6` → body-sm, `small` → caption — ב־`app/design-system.css`.

---

## צבעים וטוקנים

הטוקנים המרכזיים מוגדרים ב־`:root` ו־`.dark` ב־`app/design-system.css` וממופים ל־Tailwind תחת `@theme inline`.

| טוקן | תפקיד |
|------|--------|
| `--background` / `--foreground` | רקע דף וטקסט ראשי |
| `--card` / `--card-foreground` | כרטיסים, פאנלים |
| `--primary` / `--primary-foreground` | פעולות ראשיות, כותרות ברירת מחדל (`h1`/`h2`) |
| `--primary-hover` / `--primary-active` / `--primary-muted` | מצבי אינטראקציה למותג (לא opacity כמו `primary/40`) |
| `--muted` / `--muted-foreground` | רקע/טקסט משני |
| `--border`, `--input`, `--ring` | גבולות, שדות, פוקוס |
| `--destructive` / `--destructive-hover` / `--destructive-active` | מחיקות ושגיאות + מצבי hover/active |
| `--sidebar-*` | סרגל צד (תואם ל־primary במצב בהיר) |
| `--favorite` | צבע ייעודי למועדפים (כתום־זהוב ב־oklch) |
| `--brand-gold` / `--brand-gold-foreground` / soft / muted | זהב שיווקי ל־CTA והדגשות |
| `--chart-1` … `--chart-5` | סדרות צבע לגרפים (אם יש שימוש) |

**מצבי אינטראקציה:** השתמשו בטוקנים (`bg-primary-hover`) ולא ב־opacity על צבע המותג (`bg-primary/40`). ערכי light/dark מוגדרים בנפרד.

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

וריאנטים מוגדרים ב־`components/ui/button.tsx`: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`, ו־`destructiveOutline` (מותאם לפרויקט). גדלים: `default`, `sm`, `lg`, `icon`, `icon-sm`, `icon-lg`. Hover/active של `default` ו־`destructive` נשענים על `--primary-hover` / `--primary-active` ו־`--destructive-hover` / `--destructive-active`. פוקוס: טבעת `ring` סביב `ring`, גבול פוקוס על `border-ring`.

### כרטיסים (`Card`)

`rounded-xl border bg-card shadow`, כותרת עם `font-semibold`, תיאור ב־`text-muted-foreground text-body-sm` — `components/ui/card.tsx`.

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
| **Design System (CSS)** | `app/design-system.css` |
| Utilities / אנימציות אפליקציה | `app/globals.css` |
| קטלוג טוקנים (showcase) | `lib/design-system/tokens.ts` |
| Showcase חי (dev) | `/dev/design-system` |
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
5. **טיפוגרפיה:** רק טוקני `text-display`…`text-caption` / HTML סמנטי / `prose-km` — לא `text-sm` ולא `fontSize` inline.
6. **צבעים:** `bg-primary` / `text-muted-foreground` / `border-border` / `bg-brand-gold` — לא hex קשיח במחלקות. הרצת `pnpm test:cn` אחרי שינוי ב־`cn()`.
