import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ContactAvailability } from "@/features/shadchanim/lib/contact";
import { cn } from "@/lib/utils";
import { Ban, Info } from "lucide-react";

/** Caps the dot indicator so a large configured limit cannot blow up the layout. */
const MAX_INDICATOR_DOTS = 10;

function QuotaDots({ remaining, limit }: { remaining: number; limit: number }) {
  const dots = Math.min(limit, MAX_INDICATOR_DOTS);
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {Array.from({ length: dots }, (_, i) => (
        <span
          key={i}
          className={cn(
            "size-2 rounded-full",
            i < remaining ? "bg-primary" : "bg-muted-foreground/25",
          )}
        />
      ))}
    </span>
  );
}

function limitSentence(limit: number) {
  return `כדי לשמור על פניות איכותיות, ניתן לפנות עד ${limit} שדכנים ביום.`;
}

/** The daily-limit note and "remaining today" indicator shown in the contact popup. */
export default function ContactQuotaNote({
  availability,
}: {
  availability: ContactAvailability | null;
}) {
  if (!availability || availability.kind === "exempt") return null;

  if (availability.kind === "limit_reached") {
    return (
      <Alert variant="destructive" role="status">
        <Ban />
        <AlertDescription>
          <p>
            הגעת למכסת הפניות היומית ({availability.limit} שדכנים). ניתן יהיה
            לפנות לשדכנים נוספים מחר.
          </p>
          <p className="font-bold">נותרו לך היום: 0</p>
        </AlertDescription>
      </Alert>
    );
  }

  if (availability.kind === "reply") {
    return (
      <Alert role="status">
        <Info />
        <AlertDescription>
          השדכן הזה הציע לך שידוך, ולכן פנייה אליו לא תיספר במכסה היומית.
        </AlertDescription>
      </Alert>
    );
  }

  if (availability.kind === "already_contacted") {
    return (
      <Alert role="status">
        <Info />
        <AlertDescription>
          כבר פנית לשדכן זה היום, ולכן פנייה נוספת אליו לא תיספר במכסה היומית.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert role="status">
      <Info />
      <AlertDescription>
        <p>{limitSentence(availability.limit)}</p>
        <p className="flex items-center gap-2 font-bold text-foreground">
          <span>
            נותרו לך היום: {availability.remaining} מתוך {availability.limit}
          </span>
          <QuotaDots
            remaining={availability.remaining}
            limit={availability.limit}
          />
        </p>
      </AlertDescription>
    </Alert>
  );
}
