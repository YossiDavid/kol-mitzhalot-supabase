"use client";

import { OTPForm } from "@/components/otp-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isValidILPhone } from "@/lib/phone";

interface OTPSectionProps {
  hasPhone?: boolean;
}

export default function OTPSection({ hasPhone = true }: OTPSectionProps) {
  const [codeSent, setCodeSent] = useState(false);
  const [addedPhone, setAddedPhone] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const showAddPhone = !hasPhone && !addedPhone;

  const handleAddPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);
    const trimmed = phone.replace(/\s/g, "");
    if (!isValidILPhone(trimmed)) {
      setPhoneError("פורמט: 05XXXXXXXX או 9725XXXXXXXX");
      return;
    }
    setAddLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: { phone: trimmed },
      });
      if (error) throw error;
      setAddedPhone(true);
    } catch (err) {
      setPhoneError(
        err instanceof Error ? err.message : "שגיאה בשמירת הטלפון",
      );
    } finally {
      setAddLoading(false);
    }
  };

  const handleSendCode = async () => {
    setSendError(null);
    const response = await fetch("/api/v1/auth/otp/send", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setSendError(null);
      setCodeSent(true);
    } else {
      setSendError(data?.message || "שגיאה בשליחת הקוד");
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const otp = formData.get("otp") as string;

    const response = await fetch("/api/v1/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otp }),
    });

    if (response.ok) {
      window.location.href = "/app";
    } else {
      const data = await response.json();
      setSendError(data?.message || "אימות נכשל");
    }
  };

  if (showAddPhone) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>הוספת מספר טלפון</CardTitle>
          <CardDescription>
            נדרש מספר טלפון לאימות. הזן את המספר שלך.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddPhone}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">מספר טלפון</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="05XXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  dir="ltr"
                  className="text-left"
                  required
                />
                {phoneError && (
                  <p className="text-sm text-destructive">{phoneError}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={addLoading}>
                {addLoading ? "שומר..." : "המשך"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (codeSent) {
    return (
      <OTPForm
        handleSubmit={handleSubmit}
        channel="phone"
        error={sendError}
        onResend={handleSendCode}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>אימות מספר הטלפון</CardTitle>
        <CardDescription>
          נשלח אליך קוד אימות (SMS או הודעה קולית). לחץ לשליחה.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sendError && (
            <p className="text-sm text-destructive">{sendError}</p>
          )}
          <Button onClick={handleSendCode} className="w-full">
            שלח קוד אימות
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
