import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "../lib/user-display";

type ChatAvatarProps = {
  name: string;
  src: string | null;
  className?: string;
  fallbackClassName?: string;
};

/** אווטאר של משתתף בשיחה: תמונה כשיש, ראשי תיבות כשאין או כשהטעינה נכשלה. */
export function ChatAvatar({
  name,
  src,
  className,
  fallbackClassName,
}: ChatAvatarProps) {
  return (
    <Avatar className={cn("shrink-0", className)}>
      {src && <AvatarImage src={src} alt="" className="object-cover" />}
      <AvatarFallback
        className={cn(
          "bg-primary-muted text-caption font-semibold text-primary",
          fallbackClassName,
        )}
      >
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
