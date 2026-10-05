"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FRAME_HEIGHT_PADDING,
  NEDARIM_FRAME_ORIGIN,
  parseFrameMessage,
  type FrameEvent,
} from "@/features/donations/lib/frame-messages";
import type { StartPaymentValue } from "@/features/donations/lib/start-payment";

/** כמה זמן מחכים ל-Ready/Height לפני שמציגים הודעת תקלה */
export const FRAME_READY_TIMEOUT_MS = 15_000;

interface FrameHandlers {
  onBack: () => void;
  onTransactionOk: () => void;
}

/**
 * מנהל את ה-iframe של נדרים פלוס: מאזין יחיד ל-message, גובה, מצב טעינה ושליחת פקודות.
 *
 * חשוב (לפי הספק): מאזין אחד בלבד לאורך חיי העמוד, ו-src שנקבע פעם אחת. לכן:
 * - ה-handler יציב (תלויות ריקות) וקורא handlers עדכניים דרך ref;
 * - ה-src קבוע ב-JSX, ולכן React לא נוגע בו בין רינדורים. Strict Mode מריץ אפקטים
 *   פעמיים אך לא יוצר מחדש את אלמנט ה-DOM, וה-cleanup מסיר את המאזין הראשון.
 *
 * הערה: postMessage של הספק לא עובד על localhost, ולכן שם ה-iframe לעולם לא יהיה
 * מוכן והמשתמש יראה את הודעת התקלה אחרי FRAME_READY_TIMEOUT_MS.
 */
export function useNedarimFrame(handlers: FrameHandlers) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const handlersRef = useRef(handlers);
  const isReadyRef = useRef(false);
  const pendingStartRef = useRef<StartPaymentValue | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  const post = useCallback((message: { Name: string; Value?: unknown }) => {
    frameRef.current?.contentWindow?.postMessage(message, NEDARIM_FRAME_ORIGIN);
  }, []);

  useEffect(() => {
    function markReady() {
      isReadyRef.current = true;
      setIsReady(true);
      setHasTimedOut(false);
      // התורם לחץ "המשך" לפני שה-iframe היה מוכן: שולחים עכשיו
      const pending = pendingStartRef.current;
      pendingStartRef.current = null;
      if (pending) post({ Name: "StartPayment", Value: pending });
    }

    function handleEvent(frameEvent: FrameEvent) {
      switch (frameEvent.type) {
        case "ready":
          markReady();
          break;
        case "height":
          setHeight(frameEvent.height);
          if (!isReadyRef.current) markReady();
          break;
        case "back":
          handlersRef.current.onBack();
          break;
        case "transaction":
          // הודעה בדפדפן של התורם, ניתנת לזיוף: מספיקה להצגת תודה, לא הוכחת תשלום
          if (frameEvent.isOk) handlersRef.current.onTransactionOk();
          break;
        case "other":
          break;
      }
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== NEDARIM_FRAME_ORIGIN) return;
      if (event.source !== frameRef.current?.contentWindow) return;
      const frameEvent = parseFrameMessage(event.data);
      if (frameEvent) handleEvent(frameEvent);
    }

    window.addEventListener("message", onMessage);
    // ה-iframe נטען מה-HTML של השרת ועלול לשלוח Ready/Height לפני ההידרציה:
    // מבקשים את הגובה כדי לקבל תשובה עכשיו שהמאזין קיים
    post({ Name: "GetHeight" });
    const timer = window.setTimeout(() => {
      if (!isReadyRef.current) setHasTimedOut(true);
    }, FRAME_READY_TIMEOUT_MS);

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
    };
  }, [post]);

  const startPayment = useCallback(
    (value: StartPaymentValue) => {
      if (isReadyRef.current) {
        post({ Name: "StartPayment", Value: value });
      } else {
        pendingStartRef.current = value;
      }
    },
    [post],
  );

  const reset = useCallback(() => {
    pendingStartRef.current = null;
    post({ Name: "Reset" });
  }, [post]);

  const frameHeight = height > 0 ? height + FRAME_HEIGHT_PADDING : 0;

  return { frameRef, isReady, hasTimedOut, frameHeight, startPayment, reset };
}
