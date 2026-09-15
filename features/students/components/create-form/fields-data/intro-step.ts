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
          name: "gender",
          width: "full",
          label: "אני ממלא/ת את טופס הקו״ח עבור:",
          type: "radio",
          options: [
            { value: "male", label: "מיועד" },
            { value: "female", label: "מיועדת" },
          ],
          required: true,
          // התווית היא משפט שלם, ולכן הודעה מפורשת
          requiredMessage: "נא לבחור מיועד/מיועדת",
          beforeField: WELCOME_HTML,
        },
      ],
    },
  ],
};
