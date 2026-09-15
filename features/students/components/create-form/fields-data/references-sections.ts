import type { FormSection } from "./types";

type ContactSectionConfig = {
  name: string;
  title: string;
  addLabel: string;
  itemLabel: string;
  emptyText: string;
};

/** ממליצים עם שם, טלפון ואימייל */
function contactSection({
  name,
  title,
  addLabel,
  itemLabel,
  emptyText,
}: ContactSectionConfig): FormSection {
  return {
    name,
    title,
    fields: [
      {
        type: "repeater",
        name,
        addLabel,
        itemLabel,
        emptyText,
        fields: [
          { name: `${name}.name`, width: "lg", type: "text", label: "שם מלא" },
          { name: `${name}.phone`, width: "sm", type: "text", label: "טלפון" },
          { name: `${name}.email`, width: "sm", type: "text", label: "אימייל" },
        ],
      },
    ],
  };
}

export const referencesSections: FormSection[] = [
  {
    name: "knownRabbanim",
    title: "רבנים מכירים",
    fields: [
      {
        type: "repeater",
        name: "knownRabbanim",
        addLabel: "הוספת רב מכיר",
        itemLabel: "רב מכיר",
        emptyText: "עדיין לא נוספו רבנים מכירים.",
        // לרב אין אימייל: references לא שומרת אותו (build-student-payload.ts)
        fields: [
          {
            name: "knownRabbanim.name",
            width: "lg",
            type: "text",
            label: "שם מלא",
          },
          {
            name: "knownRabbanim.role",
            width: "sm",
            type: "text",
            label: "תפקיד",
          },
          {
            name: "knownRabbanim.phone",
            width: "sm",
            type: "text",
            label: "טלפון",
          },
        ],
      },
    ],
  },
  contactSection({
    name: "knownFriends",
    title: "חברים מכירים",
    addLabel: "הוספת חבר/ה",
    itemLabel: "חבר/ה",
    emptyText: "עדיין לא נוספו חברים מכירים.",
  }),
  contactSection({
    name: "knownFamilyFriends",
    title: "מכרים משפחתיים",
    addLabel: "הוספת מכר משפחתי",
    itemLabel: "מכר משפחתי",
    emptyText: "עדיין לא נוספו מכרים משפחתיים.",
  }),
];
