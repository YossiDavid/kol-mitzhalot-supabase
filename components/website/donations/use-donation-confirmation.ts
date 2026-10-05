"use client";

import { useEffect, useState } from "react";
import { fetchDonationStatus } from "@/features/donations/lib/intent-client";

/** האישור מהספק מגיע בדרך כלל תוך שניות; אחרי המכסה מפסיקים בשקט */
export const CONFIRMATION_POLL_INTERVAL_MS = 3_000;
export const CONFIRMATION_POLL_MAX_ATTEMPTS = 10;

export type DonationConfirmation = "processing" | "confirmed";

/**
 * אחרי שה-iframe דיווח הצלחה בודקים ברקע אם השרת קיבל את האישור החתום מהספק.
 * לעולם לא חוסם ולא מציג שגיאה: בלי אישור (למשל ב-localhost) נשארים ב"בעיבוד".
 */
export function useDonationConfirmation(
  donationId: string | null,
): DonationConfirmation {
  const [confirmedId, setConfirmedId] = useState<string | null>(null);

  useEffect(() => {
    if (!donationId) return;
    let isCancelled = false;
    let attempts = 0;
    let timer: number | undefined;

    async function poll(id: string) {
      attempts += 1;
      const status = await fetchDonationStatus(id);
      if (isCancelled) return;
      if (status === "paid") {
        setConfirmedId(id);
        return;
      }
      if (attempts < CONFIRMATION_POLL_MAX_ATTEMPTS) {
        timer = window.setTimeout(
          () => void poll(id),
          CONFIRMATION_POLL_INTERVAL_MS,
        );
      }
    }

    timer = window.setTimeout(
      () => void poll(donationId),
      CONFIRMATION_POLL_INTERVAL_MS,
    );
    return () => {
      isCancelled = true;
      window.clearTimeout(timer);
    };
  }, [donationId]);

  return donationId !== null && confirmedId === donationId
    ? "confirmed"
    : "processing";
}
