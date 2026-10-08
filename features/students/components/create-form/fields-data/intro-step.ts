import { CARD_GUIDANCE_HTML, authorFields } from "./author-fields";
import type { FormSteps } from "./types";

/**
 * פתיח ההקדמה. הניסוח של הלקוח נשמר במלואו; רק התצוגה מתקפלת:
 * - תמיד מוצג: הכותרת, "תודה על הצטרפותכם", וההוראה למלא את הטופס במלואו.
 * - מתקפל ("קראו עוד"): הבטחת הפרטיות ובקשת שיתוף הפעולה.
 * - תמיד מוצג אחרי החלק המתקפל: ההנחיה "למי מיועד הכרטיס" - חובה לקרוא.
 */
const INTRO_LEAD_HTML =
  "<h3>ברוכים הבאים למערכת השידוכים שלנו</h3><p>תודה על הצטרפותכם.</p><p>על מנת שנוכל להכיר אתכם לעומק ולהציע הצעות שידוך מותאמות ומדויקות – יש למלא את הטופס שלפניכם במלואו ובאופן מדויק.</p>";

const INTRO_MORE_HTML =
  "<p><b>המידע שתמלאו ישמר בפרטיות מוחלטת וישמש אך ורק לצורכי תהליך ההתאמה.</b></p><p>נודה על שיתוף פעולה מלא ומוקפד – זהו שלב חיוני להצלחת התהליך.</p>";

const INTRO_TAIL_HTML = `${CARD_GUIDANCE_HTML}<hr/>`;

export const introStep: FormSteps = {
  name: "intro",
  title: "הקדמה",
  sections: [
    {
      name: "intro",
      title: "",
      fields: [
        {
          name: "cardFor",
          width: "full",
          label: "מי ממלא את הכרטיס?",
          type: "radio",
          description:
            "הצעות שידוך נשלחות לכרטיסים שמולאו על ידי המיועד/ת או הוריו/ה.",
          vertical: true,
          options: [
            { value: "self", label: "המיועד/ת בעצמו/ה" },
            { value: "child", label: "אב או אם של המיועד/ת" },
            {
              value: "other",
              label: "אדם אחר (שדכן/ית, קרוב/ת משפחה, מכר/ה)",
            },
          ],
          required: true,
          // התווית היא משפט שלם, ולכן הודעה מפורשת
          requiredMessage: "נא לבחור מי ממלא את הכרטיס",
          beforeFieldCollapsible: {
            lead: INTRO_LEAD_HTML,
            more: INTRO_MORE_HTML,
            tail: INTRO_TAIL_HTML,
          },
        },
        ...authorFields,
        {
          name: "gender",
          width: "full",
          label: "מגדר המיועד/ת:",
          type: "radio",
          options: [
            { value: "male", label: "מיועד" },
            { value: "female", label: "מיועדת" },
          ],
          required: true,
          // התווית היא משפט שלם, ולכן הודעה מפורשת
          requiredMessage: "נא לבחור מיועד/מיועדת",
        },
      ],
    },
  ],
};
