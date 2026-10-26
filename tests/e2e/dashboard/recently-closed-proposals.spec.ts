import { test, expect } from "@playwright/test";

import {
  splitProposalsForDashboard,
  type ParentProposal,
} from "../../../features/shidduchim/lib/proposals-data";

const NOW = new Date("2026-10-26T12:00:00Z");

function proposal(
  id: string,
  status: ParentProposal["status"],
  sentAt: string,
): ParentProposal {
  return {
    shidduchId: id,
    side: "groom",
    status,
    shadchanId: "s",
    shadchanFirstName: null,
    shadchanLastName: null,
    note: null,
    sentAt,
    createdAt: sentAt,
    myStudentId: "m",
    myFirstName: null,
    myLastName: null,
    otherStudentId: null,
    otherFirstName: null,
    otherLastName: null,
    otherCity: null,
    otherBirthDate: null,
    myResponse: null,
    myResponseMessage: null,
    myRespondedAt: null,
  } as ParentProposal;
}

test.describe("splitProposalsForDashboard", () => {
  test("פתוחות לחוד, ונדחו ב-30 הימים האחרונים ב'נסגרו לאחרונה'", () => {
    // Arrange
    const rows = [
      proposal("open", "sent", "2026-10-25T10:00:00Z"),
      proposal("rejected-recent", "rejected", "2026-10-24T23:35:00Z"),
      proposal("rejected-old", "rejected", "2026-08-01T10:00:00Z"),
    ];

    // Act
    const { open, recentlyClosed } = splitProposalsForDashboard(rows, {
      openLimit: 5,
      closedLimit: 3,
      now: NOW,
    });

    // Assert
    expect(open.map((p) => p.shidduchId)).toEqual(["open"]);
    expect(recentlyClosed.map((p) => p.shidduchId)).toEqual([
      "rejected-recent",
    ]);
  });

  test("מכבד את המגבלות", () => {
    const rows = Array.from({ length: 6 }, (_, i) =>
      proposal(`c${i}`, "rejected", "2026-10-20T10:00:00Z"),
    );
    const { recentlyClosed } = splitProposalsForDashboard(rows, {
      openLimit: 5,
      closedLimit: 3,
      now: NOW,
    });
    expect(recentlyClosed).toHaveLength(3);
  });
});
