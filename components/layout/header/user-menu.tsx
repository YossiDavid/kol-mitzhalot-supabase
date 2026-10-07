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
  Globe,
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
  /** נרשם כדי להיות שדכן: הכניסה לטופס ההצטרפות מודגשת ועולה לראש התפריט */
  highlightShadchanJoin?: boolean;
}

export function UserMenu({
  showShadchanJoin = false,
  showStaffJoin = false,
  highlightShadchanJoin = false,
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
        {/* במובייל אין סרגל צד ואין מקום בהדר - זו הדרך לאתר הציבורי */}
        <DropdownMenuItem asChild>
          <Link
            href="/"
            className="flex items-center gap-2 font-medium"
            data-testid="user-menu-site-link"
          >
            <Globe className="h-4 w-4" />
            לאתר קול מצהלות
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app/settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            הגדרות
          </Link>
        </DropdownMenuItem>
        {showShadchanJoin && (
          <DropdownMenuItem
            asChild
            className={
              highlightShadchanJoin
                ? "bg-primary/10 font-bold text-primary"
                : undefined
            }
          >
            <Link
              href="/app/settings/shadchan"
              className="flex items-center gap-2"
              data-testid="user-menu-shadchan-join"
            >
              <HeartHandshake className="h-4 w-4" />
              {highlightShadchanJoin ? "השלמת הצטרפות כשדכן" : "הצטרפות כשדכן"}
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
