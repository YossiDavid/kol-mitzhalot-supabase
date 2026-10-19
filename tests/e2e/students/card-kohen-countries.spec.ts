import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { clientAs } from "../chats/context-fixtures";
import { TEST_USER_EMAIL, createServiceClient } from "../shidduchim/fixtures";
import { buildStudentPayload } from "../../../features/students/lib/build-student-payload";
import { studentToFormValues } from "../../../features/students/lib/student-to-form";
import { emptyStudentFormValues } from "../../../features/students/lib/student-form-wizard";
import { deleteCards } from "./third-party-card-fixtures";

/**
 * "האם כהן?" (גבר בלבד) ו"מוכן/ה לגור ב:" - מהטופס, דרך פונקציות הפרופיל, אל
 * המסד וחזרה לטופס. כהן נשמר רק בכרטיס של גבר (CHECK במסד).
 */
const T = `${Date.now()}`.slice(-8);
const COUNTRIES = ["ישראל", "אנגליה"];

let svc: SupabaseClient;
let matchmaker: SupabaseClient;
const cardIds: string[] = [];

function payloadFor(gender: "male" | "female") {
  return buildStudentPayload({
    ...emptyStudentFormValues,
    cardFor: "child",
    gender,
    firstName: "כהן",
    lastName: `כהן${T}`,
    birthDate: "1998-01-01",
    personalStatus: "single",
    country: "ישראל",
    city: "בני ברק",
    cellphoneType: "kosher",
    isKohen: "true",
    willingToLiveCountries: COUNTRIES,
  });
}

async function stored(id: string) {
  const { data } = await svc
    .from("students")
    .select("is_kohen, willing_to_live_countries")
    .eq("id", id)
    .single();
  return data;
}

test.beforeAll(async () => {
  svc = createServiceClient();
  matchmaker = await clientAs(svc, TEST_USER_EMAIL);
});

test.afterAll(async () => {
  await deleteCards(svc, cardIds);
});

test("גבר: כהן וארצות נשמרים, וחוזרים לטופס", async () => {
  // Act
  const { data: id, error } = await matchmaker.rpc(
    "create_full_student_profile",
    { payload: payloadFor("male") },
  );

  // Assert
  expect(error, error?.message).toBeNull();
  cardIds.push(id as string);
  const row = await stored(id as string);
  expect(row).toEqual({
    is_kohen: true,
    willing_to_live_countries: COUNTRIES,
  });
  const form = studentToFormValues({ ...row, id });
  expect(form.isKohen).toBe("true");
  expect(form.willingToLiveCountries).toEqual(COUNTRIES);
});

test("אשה: כהן אינו נשמר, גם כשנשלח", async () => {
  // Arrange
  const payload = { ...payloadFor("female"), is_kohen: true };

  // Act
  const { data: id, error } = await matchmaker.rpc(
    "create_full_student_profile",
    { payload },
  );

  // Assert
  expect(error, error?.message).toBeNull();
  cardIds.push(id as string);
  expect((await stored(id as string))?.is_kohen).toBeNull();
});

test("עדכון בלי המפתחות (קוד ישן) משאיר את הערכים הקיימים", async () => {
  // Arrange
  const { data: id } = await matchmaker.rpc("create_full_student_profile", {
    payload: payloadFor("male"),
  });
  cardIds.push(id as string);
  const {
    is_kohen: _kohen,
    willing_to_live_countries: _countries,
    ...legacy
  } = payloadFor("male");
  void _kohen;
  void _countries;

  // Act
  const asOwner = await matchmaker.rpc("update_full_student_profile", {
    p_student_id: id,
    payload: legacy,
  });

  // Assert
  expect(asOwner.error, asOwner.error?.message).toBeNull();
  expect(await stored(id as string)).toEqual({
    is_kohen: true,
    willing_to_live_countries: COUNTRIES,
  });
});
