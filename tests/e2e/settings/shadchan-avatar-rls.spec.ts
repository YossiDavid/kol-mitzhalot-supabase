/**
 * Callers: Playwright `chromium` project (API בלבד, סשנים אמיתיים).
 * תמונות שדכנים ב-bucket הפרטי shadchan-avatars: משתמש כותב וקורא רק בתיקייה
 * שלו, לא בתיקייה של אחר; avatar_path חייב להיות בתיקייה של בעל השורה; ובקשה
 * ממתינה של שדכן (male) בלי תמונה, או בגיל מחוץ ל-18-100, נדחית במסד.
 */
import { expect, test } from "@playwright/test";

import { serviceClient } from "../helpers/dedications";
import {
  apiClientFor,
  createSessionUser,
  deleteSessionUsers,
  type SessionUser,
} from "../helpers/session-user";
import { ADULT_BIRTH_DATE, TINY_PNG } from "../helpers/shadchan-form";

const BUCKET = "shadchan-avatars";
const INCOMPLETE = "shadchan_application_incomplete";

const pendingApplication = (userId: string) => ({
  user_id: userId,
  contact_phone: "0501234567",
  community: "בעלזא",
  synagogue_rabbi: "הרב בדיקה",
  birth_date: ADULT_BIRTH_DATE,
});

test.describe.serial("תמונות שדכנים - הרשאות ושדות חובה", () => {
  let owner: SessionUser;
  let other: SessionUser;

  test.beforeAll(async () => {
    owner = await createSessionUser({ prefix: "avatar-owner" });
    other = await createSessionUser({ prefix: "avatar-other" });
  });

  test.afterAll(async () => {
    const admin = serviceClient();
    for (const user of [owner, other]) {
      const { data } = await admin.storage.from(BUCKET).list(user.id);
      const paths = (data ?? []).map((file) => `${user.id}/${file.name}`);
      if (paths.length) await admin.storage.from(BUCKET).remove(paths);
      await admin.from("shadchanim_info").delete().eq("user_id", user.id);
    }
    await deleteSessionUsers([owner, other]);
  });

  test("כתיבה רק לתיקייה של עצמי; קריאה של תיקייה זרה חסומה", async () => {
    // Arrange
    const client = await apiClientFor(owner);
    const ownPath = `${owner.id}/${Date.now()}-own.png`;
    const foreignPath = `${other.id}/${Date.now()}-foreign.png`;
    await serviceClient()
      .storage.from(BUCKET)
      .upload(`${other.id}/seed.png`, TINY_PNG.buffer, {
        contentType: TINY_PNG.mimeType,
        upsert: true,
      });

    // Act
    const own = await client.storage
      .from(BUCKET)
      .upload(ownPath, TINY_PNG.buffer, { contentType: TINY_PNG.mimeType });
    const foreign = await client.storage
      .from(BUCKET)
      .upload(foreignPath, TINY_PNG.buffer, { contentType: TINY_PNG.mimeType });
    const ownSigned = await client.storage
      .from(BUCKET)
      .createSignedUrl(ownPath, 60);
    const foreignSigned = await client.storage
      .from(BUCKET)
      .createSignedUrl(`${other.id}/seed.png`, 60);
    const foreignRemove = await client.storage
      .from(BUCKET)
      .remove([`${other.id}/seed.png`]);

    // Assert
    expect(own.error).toBeNull();
    expect(foreign.error).not.toBeNull();
    expect(ownSigned.error).toBeNull();
    expect(foreignSigned.error).not.toBeNull();
    // remove בלי הרשאה לא נכשל אלא פשוט לא מוחק כלום
    expect(foreignRemove.data ?? []).toHaveLength(0);
    const { data: stillThere } = await serviceClient()
      .storage.from(BUCKET)
      .list(other.id);
    expect((stillThere ?? []).map((file) => file.name)).toContain("seed.png");
  });

  test("קובץ שאינו תמונה נדחה ב-bucket", async () => {
    // Arrange
    const client = await apiClientFor(owner);

    // Act
    const result = await client.storage
      .from(BUCKET)
      .upload(`${owner.id}/${Date.now()}-doc.pdf`, Buffer.from("%PDF-1.4"), {
        contentType: "application/pdf",
      });

    // Assert
    expect(result.error).not.toBeNull();
  });

  test("avatar_path חייב להיות בתיקייה של בעל השורה", async () => {
    // Arrange
    const client = await apiClientFor(owner);

    // Act
    const { error } = await client.from("shadchanim_info").insert({
      ...pendingApplication(owner.id),
      gender: "female",
      avatar_path: `${other.id}/seed.png`,
    });

    // Assert
    expect(error?.message).toContain("shadchanim_info_avatar_path_check");
  });

  test("שדכן (male) בלי תמונה, או בלי מגדר/גיל, נדחה; עם תמונה - נשמר", async () => {
    // Arrange
    const admin = serviceClient();
    const client = await apiClientFor(owner);
    const reset = () =>
      admin.from("shadchanim_info").delete().eq("user_id", owner.id);

    // Act
    await reset();
    const maleNoAvatar = await client
      .from("shadchanim_info")
      .insert({ ...pendingApplication(owner.id), gender: "male" });
    await reset();
    const noGender = await client
      .from("shadchanim_info")
      .insert(pendingApplication(owner.id));
    await reset();
    const tooYoung = await client.from("shadchanim_info").insert({
      ...pendingApplication(owner.id),
      gender: "female",
      birth_date: `${new Date().getFullYear() - 10}-01-01`,
    });
    await reset();
    const maleWithAvatar = await client.from("shadchanim_info").insert({
      ...pendingApplication(owner.id),
      gender: "male",
      avatar_path: `${owner.id}/1700000000000-avatar.png`,
    });

    // Assert
    expect(maleNoAvatar.error?.message).toBe(INCOMPLETE);
    expect(noGender.error?.message).toBe(INCOMPLETE);
    expect(tooYoung.error?.message).toBe("shadchan_age_out_of_range");
    expect(maleWithAvatar.error).toBeNull();
  });

  test("שדכן מאושר ותיק בלי מגדר/גיל/תמונה ממשיך לעדכן את הפרופיל", async () => {
    // Arrange - שורה מאושרת ישנה (service role)
    const admin = serviceClient();
    await admin.from("shadchanim_info").delete().eq("user_id", other.id);
    await admin.from("shadchanim_info").insert({
      user_id: other.id,
      application_status: "approved",
      contact_phone: "0501234567",
      community: "בעלזא",
      synagogue_rabbi: "הרב בדיקה",
    });
    const client = await apiClientFor(other);

    // Act
    const { error } = await client
      .from("shadchanim_info")
      .update({ bio: "עדכון של שדכן ותיק" })
      .eq("user_id", other.id);

    // Assert
    expect(error).toBeNull();
  });
});
