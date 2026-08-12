"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ThemeSwitcher } from "@/components/theme-switcher";
import {
  StateBlock,
  StateSplitMatrix,
  VariantSwatchRow,
  type AxisItem,
} from "./variant-table";
import {
  colorGroupLabels,
  colorTokens,
  radiusTokens,
  spacingSamples,
  typographyScale,
  type ColorSwatch,
} from "@/lib/design-system/tokens";
import { AlertCircle, Bold, Italic, Star } from "lucide-react";
import { useMemo } from "react";

type ButtonVariant = NonNullable<
  React.ComponentProps<typeof Button>["variant"]
>;
type ButtonSize = NonNullable<React.ComponentProps<typeof Button>["size"]>;
type ToggleVariant = NonNullable<
  React.ComponentProps<typeof Toggle>["variant"]
>;
type ToggleSize = NonNullable<React.ComponentProps<typeof Toggle>["size"]>;
type BadgeVariant = NonNullable<React.ComponentProps<typeof Badge>["variant"]>;

const buttonVariants: AxisItem<ButtonVariant>[] = [
  { id: "default", label: "Default" },
  { id: "secondary", label: "Secondary" },
  { id: "outline", label: "Outline" },
  { id: "ghost", label: "Ghost" },
  { id: "link", label: "Link" },
  { id: "destructive", label: "Destructive" },
  { id: "destructiveOutline", label: "Destructive Outline" },
];

const buttonSizes: AxisItem<ButtonSize>[] = [
  { id: "sm", label: "Small" },
  { id: "default", label: "Default" },
  { id: "lg", label: "Large" },
  { id: "icon-sm", label: "Icon Small" },
  { id: "icon", label: "Icon Default" },
  { id: "icon-lg", label: "Icon Large" },
];

const toggleVariants: AxisItem<ToggleVariant>[] = [
  { id: "default", label: "Default" },
  { id: "outline", label: "Outline" },
];

const toggleSizes: AxisItem<ToggleSize>[] = [
  { id: "sm", label: "Small" },
  { id: "default", label: "Default" },
  { id: "lg", label: "Large" },
];

const badgeVariantItems: AxisItem<BadgeVariant>[] = [
  { id: "default", label: "Default" },
  { id: "secondary", label: "Secondary" },
  { id: "outline", label: "Outline" },
  { id: "destructive", label: "Destructive" },
];

function ButtonSample({
  variant,
  size,
  active = false,
}: {
  variant: ButtonVariant;
  size: ButtonSize;
  active?: boolean;
}) {
  const isIcon = size === "icon" || size === "icon-sm" || size === "icon-lg";

  return (
    <Button
      variant={variant}
      size={size}
      aria-label={
        isIcon ? `${variant} ${size}${active ? " active" : ""}` : undefined
      }
      // Forces real hover: utilities via @custom-variant hover + [data-hover]
      {...(active ? { "data-hover": true } : {})}
    >
      {!isIcon && active && <Star />}
      {isIcon ? <Star /> : "כפתור"}
    </Button>
  );
}

const NAV = [
  { id: "colors", label: "צבעים" },
  { id: "typography", label: "טיפוגרפיה" },
  { id: "radius", label: "רדיוס" },
  { id: "spacing", label: "מרווחים" },
  { id: "components", label: "קומפוננטות" },
] as const;

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-6">
      <div className="space-y-1">
        <h2 className="text-heading text-primary">{title}</h2>
        <p className="max-w-prose text-body-sm text-muted-foreground">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function ColorGroup({
  group,
  tokens,
}: {
  group: ColorSwatch["group"];
  tokens: ColorSwatch[];
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-label font-medium tracking-wide text-muted-foreground uppercase">
        {colorGroupLabels[group]}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tokens.map((token) => (
          <div
            key={token.name}
            className="overflow-hidden rounded-xl border border-border bg-card"
          >
            <div
              className={`flex h-20 items-end p-3 ${token.className} ${token.fgClassName ?? "text-foreground"}`}
            >
              <span className="text-caption font-medium opacity-90">
                {token.name}
              </span>
            </div>
            <div className="space-y-0.5 p-3">
              <p className="text-body-sm font-medium">{token.description}</p>
              <p className="font-mono text-caption text-muted-foreground">
                {token.cssVar}
              </p>
              <p className="font-mono text-caption text-muted-foreground">
                {token.className}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DesignSystemShowcase() {
  const groupedColors = useMemo(() => {
    const groups: ColorSwatch["group"][] = [
      "surface",
      "brand",
      "chrome",
      "semantic",
      "sidebar",
      "chart",
    ];
    return groups.map((group) => ({
      group,
      tokens: colorTokens.filter((t) => t.group === group),
    }));
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">
              Development only
            </p>
            <h1 className="truncate text-title text-primary">Design System</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">NODE_ENV=development</Badge>
            <ThemeSwitcher />
          </div>
        </div>
        <nav className="container flex gap-1 overflow-x-auto border-t border-border py-2">
          {NAV.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="shrink-0 rounded-md px-3 py-1.5 text-body-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </header>

      <main className="container space-y-16 py-10 pb-24">
        <div className="max-w-prose space-y-2">
          <p className="text-body text-muted-foreground">
            קטלוג חי של הטוקנים והרכיבים של קול מצהלות. העמוד זמין רק ב־
            <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-sm text-foreground">
              next dev
            </code>
            ולא נכלל בפרודקשן.
          </p>
          <p className="text-body-sm text-muted-foreground">
            פונט: Ploni · RTL · shadcn/ui (New York) · Tailwind v4
          </p>
        </div>

        <Section
          id="colors"
          title="צבעוניות"
          description="טוקני CSS ב־:root / .dark, ממופים ל־Tailwind דרך @theme inline. השתמשו ב־bg-*/text-* ולא בערכים קשיחים."
        >
          <div className="space-y-10">
            {groupedColors.map(({ group, tokens }) => (
              <ColorGroup key={group} group={group} tokens={tokens} />
            ))}
          </div>
        </Section>

        <Separator />

        <Section
          id="typography"
          title="טיפוגרפיה"
          description="סולם סמנטי (~1.2). השתמשו ב־text-display / text-heading / text-body וכו׳ במקום text-4xl אקראי."
        >
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {typographyScale.map((row) => (
              <div
                key={row.token}
                className="grid gap-3 p-5 md:grid-cols-[10rem_1fr]"
              >
                <div className="space-y-1">
                  <p className="text-label font-medium">{row.token}</p>
                  <p className="font-mono text-caption text-muted-foreground">
                    {row.size}
                  </p>
                  <p className="text-caption text-muted-foreground">
                    {row.usage}
                  </p>
                </div>
                <p className={`text-foreground ${row.className}`}>
                  {row.sample}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Separator />

        <Section
          id="radius"
          title="רדיוס"
          description="בסיס --radius: 0.625rem עם נגזרות sm / md / lg / xl."
        >
          <div className="flex flex-wrap gap-6">
            {radiusTokens.map((r) => (
              <div key={r.name} className="space-y-2 text-center">
                <div
                  className={`size-20 bg-primary ${r.className}`}
                  aria-hidden
                />
                <p className="text-label font-medium">{r.name}</p>
                <p className="font-mono text-caption text-muted-foreground">
                  {r.value}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Separator />

        <Section
          id="spacing"
          title="מרווחים"
          description="סולם Tailwind הסטנדרטי (בסיס 0.25rem). העדיפו p-4 / gap-5 על ערכים שרירותיים."
        >
          <div className="flex flex-wrap items-end gap-4">
            {spacingSamples.map((s) => (
              <div key={s.name} className="space-y-2 text-center">
                <div
                  className={`mx-auto h-8 bg-primary ${s.className} rounded-sm`}
                  aria-hidden
                />
                <p className="font-mono text-caption">{s.name}</p>
                <p className="font-mono text-caption text-muted-foreground">
                  {s.rem}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Separator />

        <Section
          id="components"
          title="קומפוננטות"
          description="מטריצה אחת לכל רכיב: וריאנט × גודל, ותחת כל גודל — לא פעיל / פעיל."
        >
          <div className="space-y-12">
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-subtitle">Button</h3>
                <p className="text-caption text-muted-foreground">
                  variant × size → לא פעיל / פעיל
                </p>
              </div>
              <StateSplitMatrix<ButtonVariant, ButtonSize>
                rows={buttonVariants}
                columns={buttonSizes}
                renderCell={(row, col, state) => (
                  <ButtonSample
                    variant={row.id}
                    size={col.id}
                    active={state.id === "on"}
                  />
                )}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-subtitle">Toggle</h3>
                <p className="text-caption text-muted-foreground">
                  variant × size → לא פעיל / פעיל
                </p>
              </div>
              <StateSplitMatrix<ToggleVariant, ToggleSize>
                rows={toggleVariants}
                columns={toggleSizes}
                renderCell={(row, col, state) => (
                  <Toggle
                    key={`${row.id}-${col.id}-${state.id}`}
                    variant={row.id}
                    size={col.id}
                    defaultPressed={state.id === "on"}
                    aria-label={`${row.label} ${col.label} ${state.label}`}
                  >
                    <Star />
                  </Toggle>
                )}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-subtitle">Badge</h3>
                <p className="text-caption text-muted-foreground">variant</p>
              </div>
              <VariantSwatchRow<BadgeVariant>
                items={badgeVariantItems}
                renderItem={(item) => (
                  <Badge variant={item.id}>{item.label}</Badge>
                )}
              />
            </div>

            <div className="space-y-3">
              <h3 className="text-subtitle">
                Input / Textarea / Select / Checkbox / Switch
              </h3>
              <div className="grid max-w-md gap-5 rounded-xl border border-border bg-card p-5">
                <div className="space-y-2">
                  <Label htmlFor="ds-name" required>
                    שם פרטי
                  </Label>
                  <Input id="ds-name" placeholder="ישראל" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ds-notes">הערות</Label>
                  <Textarea id="ds-notes" placeholder="טקסט חופשי…" rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>בחירה</Label>
                  <Select defaultValue="a">
                    <SelectTrigger>
                      <SelectValue placeholder="בחר אפשרות" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a">אפשרות א</SelectItem>
                      <SelectItem value="b">אפשרות ב</SelectItem>
                      <SelectItem value="c">אפשרות ג</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <StateBlock label="Checkbox · default / checked">
                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center gap-2">
                      <Checkbox id="ds-check-off" />
                      <Label htmlFor="ds-check-off">Default</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="ds-check-on" defaultChecked />
                      <Label htmlFor="ds-check-on">Checked</Label>
                    </div>
                  </div>
                </StateBlock>
                <StateBlock label="Switch · default / checked">
                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center gap-2">
                      <Switch id="ds-switch-off" />
                      <Label htmlFor="ds-switch-off">Default</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch id="ds-switch-on" defaultChecked />
                      <Label htmlFor="ds-switch-on">Checked</Label>
                    </div>
                  </div>
                </StateBlock>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-subtitle">Toggle Group / Dropdown / Breadcrumb</h3>
              <div className="flex max-w-xl flex-col gap-5 rounded-xl border border-border bg-card p-5">
                <ToggleGroup type="multiple" variant="outline" defaultValue={["bold"]}>
                  <ToggleGroupItem value="bold" aria-label="Bold">
                    <Bold />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="italic" aria-label="Italic">
                    <Italic />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="star" aria-label="Star">
                    <Star />
                  </ToggleGroupItem>
                </ToggleGroup>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      תפריט
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel>פעולות</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>עריכה</DropdownMenuItem>
                    <DropdownMenuItem>שיתוף</DropdownMenuItem>
                    <DropdownMenuItem variant="destructive">
                      מחיקה
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink href="#">ראשי</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbLink href="#">תלמידים</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>פרופיל</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
                <div className="flex items-center gap-4">
                  <Spinner className="size-5" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="size-9 rounded-full" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-subtitle">Card</h3>
              <Card className="max-w-md">
                <CardHeader>
                  <CardTitle>כרטיס לדוגמה</CardTitle>
                  <CardDescription>
                    תיאור קצר עם text-muted-foreground
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-body-sm">
                    תוכן הכרטיס — משטחי card על רקע background.
                  </p>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button size="sm">שמירה</Button>
                  <Button size="sm" variant="outline">
                    ביטול
                  </Button>
                </CardFooter>
              </Card>
            </div>

            <div className="space-y-3">
              <h3 className="text-subtitle">Alert</h3>
              <div className="grid max-w-xl gap-3">
                <Alert>
                  <AlertCircle />
                  <AlertTitle>הודעה כללית</AlertTitle>
                  <AlertDescription>
                    זהו אלרט רגיל על רקע card.
                  </AlertDescription>
                </Alert>
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>שגיאה</AlertTitle>
                  <AlertDescription>
                    אלרט destructive לפעולות קריטיות.
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          </div>
        </Section>
      </main>
    </div>
  );
}
