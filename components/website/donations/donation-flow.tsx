"use client";

import { useRef, useState } from "react";
import type { StartPaymentValue } from "@/features/donations/lib/start-payment";
import { DonationForm } from "./donation-form";
import { DonationThanks } from "./donation-thanks";
import { PaymentFrame } from "./payment-frame";
import { useDonationConfirmation } from "./use-donation-confirmation";
import { useNedarimFrame } from "./use-nedarim-frame";

type Step = "form" | "pay" | "thanks";

interface DonationFlowProps {
  mosadId: string;
  apiValid: string;
}

/**
 * תהליך התרומה: טופס, ואז ה-iframe של נדרים פלוס, ואז תודה.
 * הטופס וה-iframe נשארים מורכבים לאורך כל התהליך (הטופס מוסתר, כדי לשמר את ערכיו
 * ב-Back, וה-iframe כדי שלא ייטען מחדש). לפני ה-iframe נוצרת כוונת תרומה בשרת, וה-id
 * שלה הוא ה-Param2; אחרי ההצלחה נבדק ברקע אם השרת קיבל אישור חתום מהספק.
 */
export function DonationFlow({ mosadId, apiValid }: DonationFlowProps) {
  const [step, setStep] = useState<Step>("form");
  // ה-id של הכוונה הנוכחית (Param2); כל המשך מהטופס יוצר כוונה חדשה
  const [donationId, setDonationId] = useState<string | null>(null);
  const confirmation = useDonationConfirmation(
    step === "thanks" ? donationId : null,
  );
  // נעילה סינכרונית נגד שליחה כפולה עד שמגיעה תוצאה או Back
  const isSendingRef = useRef(false);

  function returnToForm() {
    isSendingRef.current = false;
    setStep("form");
  }

  const frame = useNedarimFrame({
    onBack: returnToForm,
    onTransactionOk: () => setStep("thanks"),
  });

  function handleContinue(value: StartPaymentValue, intentId: string) {
    if (isSendingRef.current) return;
    isSendingRef.current = true;
    setDonationId(intentId);
    frame.startPayment(value);
    setStep("pay");
  }

  function handleReset() {
    frame.reset();
    returnToForm();
  }

  return (
    <>
      <div hidden={step !== "form"}>
        <DonationForm
          mosadId={mosadId}
          apiValid={apiValid}
          onContinue={handleContinue}
        />
      </div>
      <PaymentFrame
        frameRef={frame.frameRef}
        isVisible={step === "pay"}
        isReady={frame.isReady}
        hasTimedOut={frame.hasTimedOut}
        frameHeight={frame.frameHeight}
        onBack={handleReset}
      />
      {step === "thanks" && (
        <DonationThanks
          confirmation={confirmation}
          onAnotherDonation={handleReset}
        />
      )}
    </>
  );
}
