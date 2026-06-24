"use client";

import { OTPForm } from "@/features/auth/components/otp-form";

export default function OTPPage() {
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

  return <OTPForm handleSubmit={handleSubmit} />;
}
