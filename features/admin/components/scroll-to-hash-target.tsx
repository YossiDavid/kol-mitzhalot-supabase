"use client";

import { useEffect } from "react";

/**
 * גלילה לעוגן שבכתובת (#request-...) אחרי שהתוכן נטען. עמודי הבקשות נטענים
 * ב-Suspense, ולכן כשהדפדפן מחפש את העוגן הכרטיס עוד לא קיים. מסמן את הכרטיס
 * ב-data-anchor-target להדגשה.
 */
export function ScrollToHashTarget() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    target.dataset.anchorTarget = "true";
    target.scrollIntoView({ block: "start" });
  }, []);

  return null;
}
