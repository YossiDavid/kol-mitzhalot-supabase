import Link from "next/link";
import { User } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import ShadchanProposalCard, {
  type SideExtras,
} from "@/features/shidduchim/components/shadchan-proposal-card";
import { parseShadchanProposalRows } from "@/features/shidduchim/components/shadchan-proposals-data";
import { employmentCategoryToHebrew } from "@/features/students/lib/profile-labels";

/**
 * הפרטים הנוספים שהדשבורד שולף לכל מיועד, מעבר לשדות הכרטיס. הם
 * מאומתים בנפרד כי parents_info הוא JSON חופשי.
 */
const detailsPersonSchema = z.object({
  cv_url: z.string().nullish(),
  parents_info: z
    .object({
      father: z
        .object({
          self: z.object({ name: z.string().nullish() }).nullish(),
        })
        .nullish(),
    })
    .nullish()
    .catch(null),
  education_history: z
    .array(z.object({ name: z.string().nullish() }))
    .nullish()
    .catch(null),
  employment_history: z
    .array(
      z.object({ category: z.string().nullish(), role: z.string().nullish() }),
    )
    .nullish()
    .catch(null),
});

type DetailsPerson = z.infer<typeof detailsPersonSchema>;

const unwrapEmbed = (value: unknown) =>
  Array.isArray(value) ? (value[0] ?? null) : value;

const detailsRowSchema = z.object({
  id: z.string(),
  groom: z.preprocess(unwrapEmbed, detailsPersonSchema.nullable()).catch(null),
  bride: z.preprocess(unwrapEmbed, detailsPersonSchema.nullable()).catch(null),
});

const PARENT_PREFIX = { groom: "בן ר׳", bride: "בת ר׳" } as const;

function lastInstitution(person: DetailsPerson): string | null {
  const names = (person.education_history ?? [])
    .map((item) => item.name?.trim())
    .filter((name): name is string => Boolean(name));
  return names.at(-1) ?? null;
}

function occupation(person: DetailsPerson): string | null {
  const first = person.employment_history?.[0];
  if (first?.role?.trim()) return first.role.trim();
  if (first?.category?.trim()) {
    return employmentCategoryToHebrew(first.category.trim());
  }
  return null;
}

function toExtras(
  side: "groom" | "bride",
  person: DetailsPerson | null,
): SideExtras | undefined {
  if (!person) return undefined;
  const fatherName = person.parents_info?.father?.self?.name?.trim();
  const details = [
    fatherName ? `${PARENT_PREFIX[side]} ${fatherName}` : null,
    lastInstitution(person),
    occupation(person),
  ].filter((item): item is string => Boolean(item));

  return { details, cvUrl: person.cv_url ?? null };
}

function extrasById(
  rows: readonly unknown[],
): Map<string, Partial<Record<"groom" | "bride", SideExtras>>> {
  return new Map(
    rows.flatMap((raw) => {
      const parsed = detailsRowSchema.safeParse(raw);
      if (!parsed.success) return [];
      const { id, groom, bride } = parsed.data;
      return [
        [
          id,
          { groom: toExtras("groom", groom), bride: toExtras("bride", bride) },
        ],
      ] as const;
    }),
  );
}

/** "שידוכים באויר" — ההצעות האחרונות שהשדכן שלח, באותו כרטיס כמו ברשימה המלאה */
export default function ActiveShidduchim({
  shiduchim,
}: {
  /** שורות shidduchim גולמיות מהשאילתה בדשבורד; מאומתות כאן */
  shiduchim: readonly unknown[];
}) {
  const proposals = parseShadchanProposalRows(shiduchim);
  const extras = extrasById(shiduchim);

  if (proposals.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>עדיין לא שלחת הצעות לשידוכים</EmptyTitle>
          <EmptyDescription>זה נראה כמו זמן מצוין להתחיל, לא?</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/app/students">
              <User />
              לרשימת המיועדים
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {proposals.map((proposal) => (
        <li key={proposal.id}>
          <ShadchanProposalCard
            proposal={proposal}
            headingLevel={3}
            extras={extras.get(proposal.id)}
          />
        </li>
      ))}
    </ul>
  );
}
