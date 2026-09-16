"use client";

import { useState } from "react";

import { OTPForm } from "@/features/auth/components/otp-form";

export default function OTPPage() {
  // שגיאת אימות מהשרת - לא שדה טופס
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (otp: string) => {
    setError(null);

    const response = await fetch("/api/v1/auth/otp/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ otp }),
    });

    if (response.ok) {
      window.location.href = "/app";
      return;
    }

    const data = await response.json().catch(() => ({}));
    console.error("OTP verification failed:", data);
    setError(data?.message || "אימות נכשל");
  };

  return <OTPForm onSubmit={handleSubmit} error={error} />;
}
