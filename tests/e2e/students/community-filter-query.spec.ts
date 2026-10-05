import { test, expect } from "@playwright/test";

import {
  NO_COMMUNITY_KEY,
  buildCommunityFilterExpression,
  describeCommunityFilter,
  isCommunityChecked,
  mergeCommunityOptions,
  normalizeCommunityFilter,
  quotePostgrestValue,
} from "../../../features/students/lib/community-filter";

/**
 * בניית הביטוי של סינון הקהילה: בריחה של ערכים, NULL/ריק במפורש,
 * ובחירת הרשימה הקצרה. פונקציות טהורות - בלי דפדפן ובלי מסד.
 */

test.describe("quotePostgrestValue", () => {
  test("עוטף במרכאות כפולות", () => {
    expect(quotePostgrestValue("בעלזא")).toBe('"בעלזא"');
  });

  test("שומר על פסיק וסוגריים בתוך המרכאות", () => {
    expect(quotePostgrestValue("בית, (ישן)")).toBe('"בית, (ישן)"');
  });

  test("בורח ממרכאות ומלוכסן הפוך", () => {
    expect(quotePostgrestValue('א"ב\\ג')).toBe('"א\\"ב\\\\ג"');
  });

  test("גרש וגרשיים עבריים אינם נפגעים", () => {
    expect(quotePostgrestValue("ויז׳ניץ")).toBe('"ויז׳ניץ"');
    expect(quotePostgrestValue('חב"ד')).toBe('"חב\\"ד"');
  });
});

test.describe("buildCommunityFilterExpression", () => {
  test("בלי סינון - null", () => {
    expect(buildCommunityFilterExpression(undefined)).toBeNull();
  });

  test("only: in עם ערכים במרכאות", () => {
    expect(
      buildCommunityFilterExpression({ mode: "only", values: ["a", "b, (c)"] }),
    ).toBe('community.in.("a","b, (c)")');
  });

  test("only עם ללא-קהילה בלבד: NULL או ריק", () => {
    expect(
      buildCommunityFilterExpression({
        mode: "only",
        values: [NO_COMMUNITY_KEY],
      }),
    ).toBe('community.is.null,community.eq.""');
  });

  test("only עם שמות וללא-קהילה: שלושת התנאים", () => {
    expect(
      buildCommunityFilterExpression({
        mode: "only",
        values: ["a", NO_COMMUNITY_KEY],
      }),
    ).toBe('community.in.("a"),community.is.null,community.eq.""');
  });

  test("only ריק - ביטוי שאינו מתקיים לעולם", () => {
    expect(buildCommunityFilterExpression({ mode: "only", values: [] })).toBe(
      "and(community.is.null,community.not.is.null)",
    );
  });

  test("except: not.in משאיר גם NULL", () => {
    expect(
      buildCommunityFilterExpression({ mode: "except", values: ["a"] }),
    ).toBe('community.is.null,community.not.in.("a")');
  });

  test("except עם ללא-קהילה בלבד: לא NULL ולא ריק", () => {
    expect(
      buildCommunityFilterExpression({
        mode: "except",
        values: [NO_COMMUNITY_KEY],
      }),
    ).toBe('and(community.not.is.null,community.neq."")');
  });

  test("except עם שמות וללא-קהילה", () => {
    expect(
      buildCommunityFilterExpression({
        mode: "except",
        values: ["a", NO_COMMUNITY_KEY],
      }),
    ).toBe('and(community.not.is.null,community.neq."",community.not.in.("a"))');
  });
});

test.describe("normalizeCommunityFilter", () => {
  const options = [NO_COMMUNITY_KEY, "a", "b", "c", "d"];

  test("הכל מסומן - אין סינון", () => {
    expect(
      normalizeCommunityFilter(new Set(options), options),
    ).toBeUndefined();
  });

  test("אחד לא מסומן - except", () => {
    const checked = new Set(options.filter((o) => o !== "b"));
    expect(normalizeCommunityFilter(checked, options)).toEqual({
      mode: "except",
      values: ["b"],
    });
  });

  test("אחד מסומן - only", () => {
    expect(normalizeCommunityFilter(new Set(["c"]), options)).toEqual({
      mode: "only",
      values: ["c"],
    });
  });

  test("שום דבר לא מסומן - only ריק", () => {
    expect(normalizeCommunityFilter(new Set(), options)).toEqual({
      mode: "only",
      values: [],
    });
  });

  test("בתיקו בוחרים except", () => {
    const four = ["a", "b", "c", "d"];
    expect(normalizeCommunityFilter(new Set(["a", "b"]), four)).toEqual({
      mode: "except",
      values: ["c", "d"],
    });
  });
});

test.describe("isCommunityChecked ותיאור הכפתור", () => {
  test("בלי סינון הכל מסומן", () => {
    expect(isCommunityChecked(undefined, "a")).toBe(true);
    expect(describeCommunityFilter(undefined)).toBe("כל הקהילות");
  });

  test("only: מסומן רק מה שברשימה", () => {
    const filter = { mode: "only" as const, values: ["a", "b"] };
    expect(isCommunityChecked(filter, "a")).toBe(true);
    expect(isCommunityChecked(filter, "c")).toBe(false);
    expect(describeCommunityFilter(filter)).toBe("2 נבחרו");
  });

  test("except: מסומן כל מה שלא ברשימה, גם ערך חדש", () => {
    const filter = { mode: "except" as const, values: ["a"] };
    expect(isCommunityChecked(filter, "a")).toBe(false);
    expect(isCommunityChecked(filter, "חדש")).toBe(true);
    expect(describeCommunityFilter(filter)).toBe("ללא 1");
  });
});

test.describe("mergeCommunityOptions", () => {
  test("איחוד בלי כפילויות, מיון עברי, וללא-קהילה ראשון", () => {
    expect(
      mergeCommunityOptions(["צאנז", "בעלזא"], ["בעלזא", " אחר ", ""]),
    ).toEqual([NO_COMMUNITY_KEY, "אחר", "בעלזא", "צאנז"]);
  });
});
