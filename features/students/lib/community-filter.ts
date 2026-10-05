/**
 * סינון "קהילה / חסידות" בסגנון סינון עמודה באקסל: מסמנים מה להציג.
 *
 * המצב נשמר בצורה הקצרה ביותר שמתארת את הבחירה:
 * - undefined: הכל מסומן, אין סינון.
 * - "only": מציגים רק את הערכים שברשימה (`in`).
 * - "except": מציגים הכל חוץ מהערכים שברשימה (`not.in`).
 * כך בחירה של "כל הקהילות חוץ מאחת" לא מייצרת שאילתה עם מאות ערכים, וקהילה
 * חדשה שנוספה אחר כך נשארת מסומנת כברירת מחדל.
 */

/** מפתח הערך "ללא קהילה" ברשימת הבחירה. אינו שם קהילה אפשרי */
export const NO_COMMUNITY_KEY = "__no_community__";

export type CommunityFilter = {
  mode: "only" | "except";
  /** שמות קהילות, ואולי NO_COMMUNITY_KEY */
  values: string[];
};

/** תנאים של קהילה ריקה: השדה חופשי, ולכן ריק יכול להיות NULL או מחרוזת ריקה */
const COMMUNITY_IS_NULL = "community.is.null";
const COMMUNITY_IS_EMPTY = 'community.eq.""';
const COMMUNITY_NOT_NULL = "community.not.is.null";
const COMMUNITY_NOT_EMPTY = 'community.neq.""';
/** ביטוי שאינו מתקיים לעולם: בחירה ריקה ("הצג רק... כלום") */
const MATCH_NOTHING = "and(community.is.null,community.not.is.null)";

/**
 * ערך בתוך ביטוי הסינון של PostgREST: במרכאות כפולות, עם בריחה של `\` ו-`"`.
 * בלי המרכאות פסיק, סוגריים ונקודתיים בשם (ויז׳ניץ (ישן), "בית, א") שוברים
 * את הביטוי או הופכים אותו לביטוי אחר.
 */
export function quotePostgrestValue(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function toQuotedList(names: readonly string[]): string {
  return names.map(quotePostgrestValue).join(",");
}

function splitValues(values: readonly string[]) {
  return {
    names: values.filter((value) => value !== NO_COMMUNITY_KEY),
    includesNone: values.includes(NO_COMMUNITY_KEY),
  };
}

function buildOnlyExpression(values: readonly string[]): string {
  const { names, includesNone } = splitValues(values);
  const parts = [
    ...(names.length > 0 ? [`community.in.(${toQuotedList(names)})`] : []),
    ...(includesNone ? [COMMUNITY_IS_NULL, COMMUNITY_IS_EMPTY] : []),
  ];
  return parts.length > 0 ? parts.join(",") : MATCH_NOTHING;
}

/**
 * NOT IN ב-SQL מוציא גם שורות עם NULL (NULL NOT IN (...) אינו אמת), ולכן
 * כשלא מוציאים במפורש את "ללא קהילה" מוסיפים אותן חזרה עם is.null.
 */
function buildExceptExpression(values: readonly string[]): string | null {
  const { names, includesNone } = splitValues(values);
  if (includesNone) {
    const conditions = [
      COMMUNITY_NOT_NULL,
      COMMUNITY_NOT_EMPTY,
      ...(names.length > 0
        ? [`community.not.in.(${toQuotedList(names)})`]
        : []),
    ];
    return `and(${conditions.join(",")})`;
  }
  if (names.length === 0) return null;
  return `${COMMUNITY_IS_NULL},community.not.in.(${toQuotedList(names)})`;
}

/**
 * הביטוי לשליחה ל-`.or(...)`, או null כשאין סינון. מוחל על השאילתה כ-`or`
 * נפרד, ו-PostgREST מחבר מספר `or` ב-AND - כך הוא משתלב עם שאר הסינונים.
 */
export function buildCommunityFilterExpression(
  filter: CommunityFilter | undefined,
): string | null {
  if (!filter) return null;
  return filter.mode === "only"
    ? buildOnlyExpression(filter.values)
    : buildExceptExpression(filter.values);
}

/** האם הערך מסומן במצב הסינון הנוכחי */
export function isCommunityChecked(
  filter: CommunityFilter | undefined,
  key: string,
): boolean {
  if (!filter) return true;
  const isListed = filter.values.includes(key);
  return filter.mode === "only" ? isListed : !isListed;
}

/**
 * מצב הסינון מתוך קבוצת הערכים המסומנים. הכל מסומן = אין סינון; אחרת בוחרים
 * את הרשימה הקצרה מבין המסומנים והלא-מסומנים (בתיקו - "חוץ מ").
 */
export function normalizeCommunityFilter(
  checked: ReadonlySet<string>,
  options: readonly string[],
): CommunityFilter | undefined {
  const checkedValues = options.filter((option) => checked.has(option));
  const uncheckedValues = options.filter((option) => !checked.has(option));
  if (uncheckedValues.length === 0) return undefined;
  return uncheckedValues.length <= checkedValues.length
    ? { mode: "except", values: uncheckedValues }
    : { mode: "only", values: checkedValues };
}

/** הכיתוב על כפתור הסינון */
export function describeCommunityFilter(
  filter: CommunityFilter | undefined,
): string {
  if (!filter) return "כל הקהילות";
  return filter.mode === "only"
    ? `${filter.values.length} נבחרו`
    : `ללא ${filter.values.length}`;
}

/**
 * אפשרויות הבחירה: הקהילות הפעילות במאגר ועוד הערכים שבפועל בכרטיסים (טקסט
 * חופשי יכול להכיל ערכים שאין במאגר), בלי כפילויות ובמיון עברי.
 * "ללא קהילה" תמיד ראשון.
 */
export function mergeCommunityOptions(
  catalogNames: readonly string[],
  presentNames: readonly string[],
): string[] {
  const seen = new Set<string>();
  const names = [...catalogNames, ...presentNames]
    .map((name) => name.trim())
    .filter((name) => {
      if (!name || name === NO_COMMUNITY_KEY || seen.has(name)) return false;
      seen.add(name);
      return true;
    })
    .sort((a, b) => a.localeCompare(b, "he"));
  return [NO_COMMUNITY_KEY, ...names];
}
