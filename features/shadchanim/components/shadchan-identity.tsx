import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ShadchanPublicCard } from "@/features/shadchanim/lib/types";
import { cn } from "@/lib/utils";
import { Mail, MapPin, Phone } from "lucide-react";

const INITIALS_LENGTH = 2;

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, INITIALS_LENGTH)
    .map((part) => part[0])
    .join("");
}

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function ShadchanAvatar({
  shadchan,
  className,
}: {
  shadchan: Pick<ShadchanPublicCard, "name" | "avatarUrl">;
  className?: string;
}) {
  return (
    <Avatar className={cn("size-14", className)}>
      {shadchan.avatarUrl && (
        <AvatarImage src={shadchan.avatarUrl} alt={shadchan.name} />
      )}
      <AvatarFallback className="font-bold">
        {initialsOf(shadchan.name)}
      </AvatarFallback>
    </Avatar>
  );
}

/** Phone / email / city row. Renders nothing when the shadchan shared none of them. */
export function ShadchanContactDetails({
  shadchan,
}: {
  shadchan: Pick<ShadchanPublicCard, "phone" | "email" | "city">;
}) {
  if (!shadchan.phone && !shadchan.email && !shadchan.city) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-body-sm text-muted-foreground">
      {shadchan.phone && (
        <li className="flex items-center gap-1.5">
          <Phone className="size-4 shrink-0" aria-hidden />
          <a href={telHref(shadchan.phone)} dir="ltr" className="hover:underline">
            {shadchan.phone}
          </a>
        </li>
      )}
      {shadchan.email && (
        <li className="flex min-w-0 items-center gap-1.5">
          <Mail className="size-4 shrink-0" aria-hidden />
          <a
            href={`mailto:${shadchan.email}`}
            dir="ltr"
            className="truncate hover:underline"
          >
            {shadchan.email}
          </a>
        </li>
      )}
      {shadchan.city && (
        <li className="flex items-center gap-1.5">
          <MapPin className="size-4 shrink-0" aria-hidden />
          <span>{shadchan.city}</span>
        </li>
      )}
    </ul>
  );
}
