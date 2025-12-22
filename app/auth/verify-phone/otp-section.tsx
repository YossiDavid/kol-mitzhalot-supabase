"use client";
import { OTPForm } from "@/components/otp-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";

export default function OTPSection() {
  const [codeSent, setCodeSent] = useState(false);

  const handleSendCode = async () => {
    const response = await fetch("/api/v1/auth/otp/send", {
      method: "POST",
    });
    if (response.ok) {
      setCodeSent(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const otp = formData.get("otp") as string;

    const response = await fetch("/api/v1/auth/otp/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ otp }),
    });

    if (response.ok) {
      // Redirect or show success message
      window.location.href = "/app";
    } else {
      const data = await response.json();
      console.error("OTP verification failed:", data);
    }
  };

  if (codeSent) {
    return <OTPForm handleSubmit={handleSubmit} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>אימות מספר הטלפון</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={handleSendCode}>שלח קוד אימות</Button>
      </CardContent>
    </Card>
  );
}
