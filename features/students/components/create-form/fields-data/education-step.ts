import { educationInstitutionSections } from "./education-institutions-sections";
import { employmentSection } from "./employment-section";
import { previousPartnersSection } from "./previous-partners-section";
import { referencesSections } from "./references-sections";
import type { FormSteps } from "./types";

/** "פרטים נוספים": השכלה, תעסוקה, נישואים קודמים וממליצים */
export const educationStep: FormSteps = {
  name: "education",
  title: "פרטים נוספים",
  sections: [
    ...educationInstitutionSections,
    employmentSection,
    previousPartnersSection,
    ...referencesSections,
  ],
};
