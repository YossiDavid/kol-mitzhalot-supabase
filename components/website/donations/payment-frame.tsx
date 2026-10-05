import type { RefObject } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NEDARIM_FRAME_URL } from "@/features/donations/lib/frame-messages";

interface PaymentFrameProps {
  frameRef: RefObject<HTMLIFrameElement | null>;
  /** האם מציגים אותו עכשיו; ה-iframe עצמו נשאר מורכב תמיד */
  isVisible: boolean;
  isReady: boolean;
  hasTimedOut: boolean;
  frameHeight: number;
  onBack: () => void;
}

/**
 * ה-iframe של נדרים פלוס. נשאר מורכב מההתחלה (גובה 0) כדי שייטען ויהיה מוכן,
 * וה-src קבוע כדי שלא ייקבע מחדש (נדרש לפי הספק). allow="payment" דרוש ל-Google/Apple Pay.
 */
export function PaymentFrame({
  frameRef,
  isVisible,
  isReady,
  hasTimedOut,
  frameHeight,
  onBack,
}: PaymentFrameProps) {
  const showLoading = isVisible && !isReady && !hasTimedOut;
  const showFailure = isVisible && !isReady && hasTimedOut;

  return (
    <div
      className={isVisible ? undefined : "h-0 overflow-hidden"}
      data-testid="donation-frame-wrapper"
      aria-hidden={!isVisible}
      inert={!isVisible}
    >
      {showLoading && (
        <p role="status" className="py-8 text-body text-muted-foreground">
          טוענים את מסך התשלום...
        </p>
      )}
      {showFailure && (
        <div
          role="alert"
          data-testid="donation-frame-failed"
          className="flex flex-col items-start gap-4 rounded-xl border border-border bg-card p-6 md:p-8"
        >
          <h3 className="text-subtitle font-bold text-foreground">
            לא הצלחנו לטעון את מסך התשלום
          </h3>
          <p className="text-body text-muted-foreground">
            אפשר לנסות שוב מאוחר יותר, או לפנות אלינו ונסייע בתרומה בדרך אחרת.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={onBack}>
              חזרה לטופס
            </Button>
            <Button asChild>
              <Link href="/contact">צרו קשר</Link>
            </Button>
          </div>
        </div>
      )}
      <iframe
        ref={frameRef}
        id="NedarimFrame"
        title="תשלום מאובטח בנדרים פלוס"
        src={NEDARIM_FRAME_URL}
        allow="payment"
        scrolling="no"
        style={{ width: "100%", border: "none", height: frameHeight }}
      />
    </div>
  );
}
