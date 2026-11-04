import { expect, test } from "@playwright/test";

import { CARD_MANAGER_EMAIL, clientAs } from "../chats/context-fixtures";
import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

/** ה-bucket "students" מקבל רק תמונות ו-PDF (לא HTML/SVG שאפשר לארח בהם פישינג) */
test("העלאת HTML ל-bucket students נדחית, ו-PDF מתקבל", async () => {
  // Arrange
  const svc = createServiceClient();
  const ownerId = await getTestUserId(svc, CARD_MANAGER_EMAIL);
  const owner = await clientAs(svc, CARD_MANAGER_EMAIL);
  const stamp = Date.now();
  const htmlPath = `${ownerId}/limits-${stamp}.html`;
  const pdfPath = `${ownerId}/limits-${stamp}.pdf`;

  // Act
  const html = await owner.storage
    .from("students")
    .upload(htmlPath, new Blob(["<h1>x</h1>"], { type: "text/html" }), {
      contentType: "text/html",
    });
  const pdf = await owner.storage
    .from("students")
    .upload(pdfPath, new Blob(["%PDF-1.4"], { type: "application/pdf" }), {
      contentType: "application/pdf",
    });

  // Assert
  expect(html.error).not.toBeNull();
  expect(pdf.error, pdf.error?.message).toBeNull();
  await svc.storage.from("students").remove([htmlPath, pdfPath]);
});
