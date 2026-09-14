"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CircleUser,
  GraduationCap,
  HeartHandshake,
  LogOut,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { SITE_CONTENT_LINKS } from "@/components/layout/site-content-links";

interface UserMenuProps {
  showShadchanJoin?: boolean;
  showStaffJoin?: boolean;
}

export function UserMenu({
  showShadchanJoin = false,
  showStaffJoin = false,
}: UserMenuProps) {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" title="תפריט משתמש">
          <CircleUser className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href="/app/settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            הגדרות
          </Link>
        </DropdownMenuItem>
        {showShadchanJoin && (
          <DropdownMenuItem asChild>
            <Link
              href="/app/settings/shadchan"
              className="flex items-center gap-2"
            >
              <HeartHandshake className="h-4 w-4" />
              הצטרפות כשדכן
            </Link>
          </DropdownMenuItem>
        )}
        {showStaffJoin && (
          <DropdownMenuItem asChild>
            <Link
              href="/app/settings/staff"
              className="flex items-center gap-2"
            >
              <GraduationCap className="h-4 w-4" />
              הצטרפות כאיש צוות
            </Link>
          </DropdownMenuItem>
        )}
        {/* תוכן האתר - במובייל אין תפריט צד ופוטר, וזו הדרך היחידה אליו */}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-caption text-muted-foreground">
          מידע ותוכן
        </DropdownMenuLabel>
        {SITE_CONTENT_LINKS.map(({ title, href, icon: Icon }) => (
          <DropdownMenuItem key={href} asChild>
            <Link href={href} className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              {title}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={logout}
          className="flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          התנתקות
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
