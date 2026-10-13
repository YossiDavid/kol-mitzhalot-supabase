import {
  parentsInfoFromNames,
  toAnonymousRowFromBasic,
  type AnonymousStudentRow,
  type FullStudentRow,
} from "@/features/students/lib/student-card-data";
import { withoutFillReason } from "@/features/students/lib/author-info";
import type { LoadedStudentCard } from "@/features/students/lib/load-student-card";
import {
  redactProposalStudent,
  withoutFamilyContact,
} from "@/features/students/lib/student-proposal-card";

/**
 * הכרטיס כפי שרכיב התצוגה מקבל אותו, בכל וריאנט מחובר: שלוש העמודות
 * הקבועות חובה, וכל השאר אופציונלי - כי כל וריאנט שולף חלק מהן בלבד
 * (בבסיסי אין about/family_info/טבלאות רגישות, בהצעה אין טלפון וכתובת
 * אלא אם נפתחו). הטיפוסים של הווריאנטים עצמם צרים וקבועים
 * (load-student-card.ts); כאן הם רק מורחבים לצורך התצוגה, ללא cast.
 */
export type StudentCardData = Pick<
  FullStudentRow,
  "id" | "first_name" | "last_name"
> &
  Partial<Omit<FullStudentRow, "id" | "first_name" | "last_name">>;

export type ShapedStudentCard =
  | { audience: "anonymous"; student: AnonymousStudentRow }
  | { audience: "member"; student: StudentCardData };

export type CardViewer = {
  userId: string | null;
  isAdmin: boolean;
};

/** author_info בלי ההסבר "מדוע מילאתי", אלא אם הצופה מנהל או הממלא עצמו */
function limitFillReason<R extends { author_info: object | null }>(
  row: R,
  canSeeFillReason: boolean,
): R {
  if (canSeeFillReason || !row.author_info) return row;
  return { ...row, author_info: withoutFillReason(row.author_info) };
}

/**
 * הצעד האחרון לפני הרינדור: מצמצם את הווריאנט לצורה שהתצוגה מכירה.
 * חייב לרוץ בשרת, לפני שהשורה מגיעה לרכיב - חיתוך פרטי ההתקשרות
 * שבתוך עמודות ה-JSON (הצעה) והסרת ההסבר (מדוע מילאתי) נעשים כאן.
 */
export function shapeStudentCard(
  card: LoadedStudentCard,
  viewer: CardViewer,
): ShapedStudentCard {
  switch (card.variant) {
    case "anonymous":
      // גולש אנונימי אינו מנהל ואינו הממלא
      // הכרטיס הציבורי אינו מציג פרטי קשר של אף אדם: טלפון ואימייל של
      // ההורים ושל הממלא נחתכים כאן, לפני שהשורה מגיעה לרינדור (הממליצים
      // נשלפים מלכתחילה בלי טלפון ואימייל)
      return {
        audience: "anonymous",
        student: withoutFamilyContact(limitFillReason(card.row, false)),
      };
    case "anonymous-basic":
      return {
        audience: "anonymous",
        student: withoutFamilyContact(
          limitFillReason(toAnonymousRowFromBasic(card.row), false),
        ),
      };
    case "basic": {
      const row = parentsInfoFromNames(card.row);
      return {
        audience: "member",
        student: limitFillReason(row, canSeeFillReason(row.user_id, viewer)),
      };
    }
    case "proposal": {
      // שורת הצעה אינה נושאת user_id, ולכן ההסבר גלוי רק למנהל
      // פרטי ההתקשרות שבתוך ה-JSON נחתכים תמיד: הצד השני אינו מקבל אותם
      const row = limitFillReason(card.row, viewer.isAdmin);
      return { audience: "member", student: redactProposalStudent(row) };
    }
    case "full":
      return {
        audience: "member",
        student: limitFillReason(
          card.row,
          canSeeFillReason(card.row.user_id, viewer),
        ),
      };
  }
}

function canSeeFillReason(ownerId: string | undefined, viewer: CardViewer) {
  return (
    viewer.isAdmin ||
    Boolean(ownerId && viewer.userId && ownerId === viewer.userId)
  );
}
