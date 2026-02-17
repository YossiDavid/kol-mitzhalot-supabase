"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { DashboardSection, Box } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

type Role = "admin" | "shadchan" | "user";

const ROLE_LABELS: Record<Role, string> = {
  user: "משתמש",
  shadchan: "שדכן",
  admin: "מנהל מערכת",
};

export default function CreateAdminUserPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!email) {
      setError("יש להזין אימייל למשתמש החדש");
      return;
    }

    if (!phone) {
      setError("יש להזין טלפון למשתמש החדש");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: firstName || null,
          lastName: lastName || null,
          email,
          phone,
          role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data?.error ||
            "אירעה שגיאה בעת יצירת המשתמש. נסה/י שוב מאוחר יותר.",
        );
        return;
      }

      // ניתוב לדף פרטי המשתמש החדש אם קיים מזהה, אחרת חזרה לרשימה
      if (data?.id) {
        router.push(`/app/admin/users/${data.id}`);
      } else {
        router.push("/app/admin/users");
      }
    } catch (error) {
      console.error("Error creating user:", error);
      setError("אירעה שגיאה לא צפויה בעת יצירת המשתמש");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-10 py-4">
      <DashboardSection
        title="יצירת משתמש חדש"
        subTitle="הוספת משתמש חדש למערכת"
        button={
          <Button asChild variant="outline">
            <Link href="/app/admin/users">חזרה לרשימת המשתמשים</Link>
          </Button>
        }
      >
        <Box className="mt-6 max-w-xl space-y-6">
          {error && (
            <div className="border-destructive bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="firstName">שם פרטי</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="לדוגמה: ישראל"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="lastName">שם משפחה</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="לדוגמה: כהן"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="user@example.com"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">טלפון</Label>
              <Input
                id="phone"
                type="tel"
                required
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="לדוגמה: 050-0000000"
              />
            </div>

            <div className="grid gap-2">
              <Label>תפקיד במערכת</Label>
              <Select value={role} onValueChange={(value) => setRole(value as Role)}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר תפקיד">
                    {role ? ROLE_LABELS[role] : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">{ROLE_LABELS.user}</SelectItem>
                  <SelectItem value="shadchan">{ROLE_LABELS.shadchan}</SelectItem>
                  <SelectItem value="admin">{ROLE_LABELS.admin}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                asChild
                disabled={isSubmitting}
              >
                <Link href="/app/admin/users">ביטול</Link>
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "יוצר משתמש..." : "יצירת משתמש"}
              </Button>
            </div>
          </form>
        </Box>
      </DashboardSection>
    </div>
  );
}

