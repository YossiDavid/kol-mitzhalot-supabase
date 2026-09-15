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
| `--success` / `--warning` / `--info` (+ `-foreground`, `-muted`, `-muted-foreground`) | סטטוסים: גוון מלא עם טקסט עליו, וגוון רך (רקע) עם טקסט כהה. במקום צבעי Tailwind ישירים (`bg-amber-100`, `text-green-600`) |
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
- **טבלאות**: רק `DataTable` (ראו למטה) — לא רשת `grid-cols-[...]` ולא `<table>` ידני.

---

## רכיבים ודפוסים

### כפתורים (`Button`)

וריאנטים מוגדרים ב־`components/ui/button.tsx`: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`, ו־`destructiveOutline` (מותאם לפרויקט). גדלים: `default`, `sm`, `lg`, `icon`, `icon-sm`, `icon-lg`. Hover/active של `default` ו־`destructive` נשענים על `--primary-hover` / `--primary-active` ו־`--destructive-hover` / `--destructive-active`. פוקוס: טבעת `ring` סביב `ring`, גבול פוקוס על `border-ring`.

### סולם גבהים (`components/ui/control-size.ts`)

שדה טקסט, רשימה נפתחת (`NativeSelect`, `Select`), שדה חיפוש (`Combobox`), `InputGroup` וכפתור לוקחים את הגובה ממקור אחד, כדי שיתיישרו באותה שורה. במובייל גבוה יותר, למגע.

| גודל | מובייל | מ־`md` |
|------|--------|--------|
| `sm` | 36px (`h-9`) | 32px (`h-8`) |
| `default` | 44px (`h-11`) | 40px (`h-10`) |
| `lg` | 48px (`h-12`) | 48px |

כפתורי אייקון (`icon-sm` / `icon` / `icon-lg`) — אותו סולם, מרובע. אין לתת לפקדים גובה ידני (`h-8` וכו'); כשצריך גודל אחר — `size="sm"`.

### תגים (`Badge`)

וריאנטים מלאים: `default`, `secondary`, `destructive`, `outline`. לסטטוסים — גוונים רכים: `neutral`, `info`, `success`, `warning`, `danger`. התג מרונדר כ־`span`, ולכן אפשר להציב אותו בתוך טקסט.

### טפסים

- **שדה בטופס:** `FormFieldShell` (`components/ui/form-field-shell.tsx`) בתוך `render` של `FormField` — תווית מודגשת עם `required`, הפקד, טקסט עזרה **תמיד מתחת לפקד**, ושגיאה. `FormControl` מסמן `aria-invalid` כשיש שגיאה.
- **`FormField` גנרי:** מקבל `control={form.control}` של טופס מוקלד — אין צורך ב־`as any`.
- **שדה עם תוספות:** `InputGroup` (`components/ui/input-group.tsx`) — `InputGroupInput` לפקד הראשי, `InputGroupAddon` לטקסט או אייקון, `InputGroupSelect` לרשימה קומפקטית (למשל תואר לפני ואחרי שם). המסגרת, הפוקוס והשגיאה שייכים לקבוצה.

### טבלאות (`DataTable`)

`components/data-table` — טבלה סמנטית (`components/ui/table.tsx`) מ־`md`, וכרטיסים במובייל. אינה רכיב לקוח, ולכן אפשר להציג אותה ישירות מעמוד שרת; רק שורה־קישור רצה בלקוח.

```tsx
const COLUMNS: DataTableColumn<User>[] = [
  { key: "name", header: "שם", size: "grow", mobile: "title", cell: (u) => u.name },
  { key: "email", header: "אימייל", size: "grow", className: "wrap-anywhere", cell: (u) => u.email },
  { key: "status", header: "סטטוס", size: "min", mobile: "aside", cell: (u) => <Badge variant="success">פעיל</Badge> },
  { key: "actions", header: <span className="sr-only">פעולות</span>, size: "min", mobile: "actions", cell: (u) => <Button size="sm">צפייה</Button> },
];

<DataTable caption="משתמשים" columns={COLUMNS} rows={users} getRowKey={(u) => u.id} emptyState={<Empty>…</Empty>} />
```

| תכונה | מה עושה |
|------|--------|
| `size` | `min` צמודה לתוכן בלי שבירה (מספרים, תגים, פעולות); `grow` מקבלת את המקום שנשאר; `auto` (ברירת מחדל) |
| `align` | `start` / `center` / `end` — כיוון לוגי |
| `mobile` | מקום בכרטיס: `title`, `aside` (לצד הכותרת), `field` (תווית/ערך, ברירת מחדל), `actions` (בתחתית), `hidden` |
| `mobileLabel` | תווית בכרטיס כשכותרת העמודה לא מתאימה |
| `getRowLink` | `{ href, label }` — השורה והכרטיס כולם קישור (לחיצה, Enter, Cmd/Ctrl ללשונית חדשה). פקדים בתוך השורה שומרים על הפעולה שלהם |
| `rowClassName` | הדגשת שורה בטוקנים (למשל `bg-warning-muted`) |
| `mobileTitle` | כותרת כרטיס מותאמת (למשל שם פרטי + משפחה משתי עמודות) |
| `breakpoint` | `md` (ברירת מחדל); `lg` לטבלאות עם הרבה עמודות (טבלת המיועדים); `xl` לטבלאות ניהול רחבות שגולשות בטאבלט לצד סרגל הצד (משתמשים, שדכנים) |
| `surface` | `false` כשהטבלה כבר בתוך `Box` — כרטיסי המובייל מקבלים מסגרת במקום רקע |

**טבלת מיועדים:** `StudentsTable` (`features/students/components/students-table.tsx`) עם `preset="list" | "favorites" | "children"`. נוסח הסטטוס האישי — רק `personalStatusToHebrew` (`features/students/lib/profile-labels.ts`).

### כרטיסים (`Card`)

מתכון אחד — `components/ui/card.tsx`. המשטח הוא `.box` (`bg-card rounded-xl`) עם `border`, והריפוד והמרווח בין החלקים שייכים ל־`Card` עצמו: `CardHeader`, `CardContent` ו־`CardFooter` לא מוסיפים ריפוד.

| חלק | מחלקות ושימוש |
|------|--------|
| `Card` (ברירת מחדל) | `box border flex flex-col gap-5 p-5 md:p-6` — כרטיס עצמאי: טופס, פרופיל, פוסט, בקשה |
| `Card size="sm"` | `gap-4 p-4 md:p-5` — כרטיס ברשימה או ברשת, או כרטיס בתוך `Box` |
| `CardHeader` | רשת: `CardTitle` ו־`CardDescription` זה מתחת לזה, `CardAction` (תג, כפתור) בעמודה צמודה בצד השני |
| `CardTitle` | `text-subtitle font-bold leading-tight`. כותרת סמנטית: `<CardTitle asChild><h2>…</h2></CardTitle>` |
| `CardDescription` | `text-body-sm text-muted-foreground` |
| `CardFooter` | `flex flex-wrap items-center gap-2` |

```tsx
<Card asChild size="sm">
  <article aria-labelledby={titleId}>
    <CardHeader>
      <CardTitle asChild><h2 id={titleId}>{title}</h2></CardTitle>
      <CardDescription>{date}</CardDescription>
      <CardAction><Badge variant="success">אושר</Badge></CardAction>
    </CardHeader>
    <CardContent>…</CardContent>
    <CardFooter><Button size="sm" variant="outline">פתיחה</Button></CardFooter>
  </article>
</Card>
```

- `asChild` כשהכרטיס הוא `article` או קישור. כרטיס ניווט שכולו קישור: `LinkCard` (`components/layout/link-card.tsx`).
- אין כרטיס ידני (`rounded-xl border bg-card p-5`), אין `rounded-2xl` ואין `shadow`: ההפרדה מהרקע היא המסגרת. כרטיס אינטראקטיבי מקבל `hover:bg-accent`.
- כרטיס בקשת הצטרפות בהגדרות: `ApplicationStatusCard role="shadchan" | "staff"` (`features/settings/components/application-status-card.tsx`).

### תיבת תוכן (`Box`) מול `Card`

**החלטה:** `.box` נשאר משטח הבסיס (`app/design-system.css`), ושני רכיבים נשענים עליו:

- **`Box`** (`components/layout/box.tsx`) — `.box p-4` בלי מסגרת: חלונית שמקבצת תוכן בעמוד (טבלה, רשימה, עורך, מקטע של כרטיס מיועד). כל ה־props (id, onClick, aria, data) מועברים לאלמנט.
- **`Card`** — `.box` עם מסגרת, ריפוד וחלקים: יחידה עצמאית עם כותרת, או פריט ברשימה (גם בתוך `Box`).

`.box` ישירות ב־`className` — רק ברכיבי תשתית (`DataTable`, `Empty`, חלונית הצ'אט).

### מצבים ריקים (`Empty`)

כל הודעת "אין …", "לא נמצאו …" או "עדיין לא …" היא `Empty` (`components/ui/empty.tsx`), לא `div` או `p` ידניים. גם שגיאת טעינה ברשימה, עם כפתור "נסו שוב".

| תכונה | ערכים |
|------|--------|
| `size` | `default` — רשימה או עמוד שלמים ריקים (כותרת `text-title`, תיאור `text-body`); `compact` — בתוך מקטע, כרטיס או טבלה (כותרת `text-subtitle`, תיאור `text-body-sm`) |
| `surface` | `true` (ברירת מחדל) — משטח `.box` משלו; `false` — כשהוא כבר יושב על `Box`, `Card` או חלונית |

```tsx
<Box>
  <DataTable
    surface={false}
    emptyState={
      <Empty size="compact" surface={false}>
        <EmptyHeader>
          <EmptyTitle>אין בקשות ממתינות</EmptyTitle>
          <EmptyDescription>בקשה חדשה תופיע כאן ותישלח אליכם גם כהתראה</EmptyDescription>
        </EmptyHeader>
        <EmptyContent><Button>…</Button></EmptyContent>
      </Empty>
    }
    …
  />
</Box>
```

- הכותרת היא ההודעה, התיאור הוא ההסבר, וכפתור פעולה תמיד בתוך `EmptyContent`.
- אייקון אופציונלי: `<EmptyMedia variant="icon"><Icon /></EmptyMedia>` (למשל בחלונית הצ'אט).
- מקטעי לוח הבקרה — `compact` עם משטח; רשימות עמוד מלא (הצעות, פורום, מיועדים, בקשות) — `default`.

### מצבי טעינה

- **שלד לתוכן, `Spinner` לפעולה.** עמוד או מקטע שנטענים מציגים שלד בצורת התוכן; `Spinner` רק בתוך כפתור או פעולה נקודתית.
- **אין `loading.tsx`.** המעטפת של `/app` חוסמת בכוונה (`app/app/layout.tsx`), וכל עמוד עוטף את החלק שתלוי בנתונים ב־`Suspense` עם שלד. כותרת קבועה מוצגת כ־`PageHeader` אמיתי גם בזמן הטעינה; `PageHeaderSkeleton` רק כשהכותרת עצמה תלויה בנתונים.
- **אזור טעינה אחד.** כל שלד עטוף ב־`SkeletonRegion` (`role="status"`, `aria-label="טוען"`), והחלקים בתוכו `aria-hidden`. הבדיקות ממתינות לו.
- גובה פקד בשלד כמו בסולם הגבהים (`h-11 md:h-10`), כדי שלא תהיה קפיצה.

| חלק | קובץ | שימוש |
|------|------|--------|
| `Skeleton`, `SkeletonRegion`, `ListSkeleton` | `components/ui/skeleton.tsx` | פס בודד; אזור הטעינה; רשימת `divide-y` בתוך `Box` |
| `PageHeaderSkeleton` | `components/layout/page-header.tsx` | כותרת שתלויה בנתונים (עורך מאמר, דף הגדרה, כרטיס שידוך) |
| `DataTableSkeleton` | `components/data-table/data-table-skeleton.tsx` | אותה צורה כמו `DataTable`: טבלה מה־`breakpoint`, כרטיסים מתחתיו, אותו `surface` |
| `CardSkeleton`, `CardGridSkeleton` | `components/ui/card-skeleton.tsx` | כרטיס טופס (`fields`), טקסט (`lines`), כפתור (`footer`); רשימה או רשת כרטיסים (`columns`) |

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
| סולם גבהים | `components/ui/control-size.ts` |
| שדות בטופס | `components/ui/form-field-shell.tsx`, `components/ui/input-group.tsx` |
| טבלאות | `components/data-table/data-table.tsx`, `components/ui/table.tsx` |
| צילומי לפני/אחרי | `pnpm capture:ui <label>` (`scripts/capture-ui.mjs`) |

---

## הנחיות קצרות לפיתוח חדש

1. להעדיף **טוקני theme** (`bg-background`, `text-foreground`, `border-border`, `text-primary`, וכו') על פני צבעים קשיחים.
2. לשמור על **מיכל** ועל **מרווחי אנכיים** (`py-5`) כמו בשאר האפליקציה, אלא אם יש סיבה מוצרתית אחרת.
3. לכבד **RTL**: יישור, סדר אלמנטים, ומיקום תפריטים נפתחים (`align` ב־Dropdown וכדומה).
4. לרכיבים חדשים — להרחיב את **shadcn** הקיים ואת `cn()` מ־`lib/utils.ts` לשילוב מחלקות.
5. **טיפוגרפיה:** רק טוקני `text-display`…`text-caption` / HTML סמנטי / `prose-km` — לא `text-sm` ולא `fontSize` inline. באתר תדמית (`.site-marketing`) הסולם מוגדל אוטומטית; כותרת הירו: `text-hero`.
6. **צבעים:** `bg-primary` / `text-muted-foreground` / `border-border` / `bg-brand-gold` — לא hex קשיח במחלקות. הרצת `pnpm test:cn` אחרי שינוי ב־`cn()`.
7. **רוחב אתר תדמית:** `shell-site` ≈ 90% מרוחב העמוד (עד 1760px) — לא `max-w-[1120px]`.
