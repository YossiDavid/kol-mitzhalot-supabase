import { getAppOrigin } from "@/lib/app-url";

/**
 * נתונים מובנים (JSON-LD) לגוגל: שם האתר (WebSite) והארגון עם הלוגו
 * (Organization). עוזר לגוגל להציג את השם "קול מצהלות" והלוגו בתוצאות,
 * ולזהות את האתר כגוף אחד. התוכן קבוע - אין בו קלט משתמש.
 */
export function SiteStructuredData() {
  const origin = getAppOrigin();
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        url: origin,
        name: "קול מצהלות",
        alternateName: ["Kol Mitzhalot", "קול מצהלות שידוכים"],
        inLanguage: "he",
        publisher: { "@id": `${origin}/#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${origin}/#organization`,
        name: "קול מצהלות",
        alternateName: "Kol Mitzhalot",
        description: "הארגון לקידום שידוכים בציבור החסידי",
        url: origin,
        logo: `${origin}/icon.png`,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // JSON קבוע מהקוד; "<" מוחלף כדי שלא ייסגר תג ה-script
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
