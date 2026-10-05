import type { FormSteps } from "./types";

const WELCOME_HTML =
  "<h3>ברוכים הבאים למערכת השידוכים שלנו</h3><p>תודה על הצטרפותכם.</p><p>על מנת שנוכל להכיר אתכם לעומק ולהציע הצעות שידוך מותאמות ומדויקות – יש למלא את הטופס שלפניכם במלואו ובאופן מדויק.</p><p><b>המידע שתמלאו ישמר בפרטיות מוחלטת וישמש אך ורק לצורכי תהליך ההתאמה.</b></p><p>נודה על שיתוף פעולה מלא ומוקפד – זהו שלב חיוני להצלחת התהליך.</p><hr/>";

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
          label: "אני ממלא/ת את הכרטיס:",
          type: "radio",
          options: [
            { value: "self", label: "עבור עצמי" },
            { value: "child", label: "עבור בני או בתי" },
            { value: "other", label: "עבור אדם אחר" },
          ],
          required: true,
          // התווית היא משפט שלם, ולכן הודעה מפורשת
          requiredMessage: "נא לבחור עבור מי ממלאים את הכרטיס",
          beforeField: WELCOME_HTML,
        },
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
