import { createClient } from "@/lib/supabase/server";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import {
  DONATIONS_PAGE_SIZE,
  type DonationsQuery,
} from "@/features/admin/lib/donations-query";
import {
  isDonationStatus,
  type DonationStatus,
} from "@/features/donations/lib/status";

/**
 * דוח התרומות לניהול. הקריאה בסשן של המנהל: מדיניות ה-RLS על donations
 * ו-donation_payments מחזירה שורות למנהל בלבד.
 */

const UNMATCHED_LIMIT = 20;

export type DonationRow = {
  id: string;
  createdAt: string;
  amount: number;
  frequency: "one_time" | "monthly";
  status: DonationStatus;
  dedicationText: string | null;
  donorName: string | null;
  donorPhone: string | null;
  donorEmail: string | null;
  /** מזהה העסקה הראשונה אצל הספק */
  providerTransactionId: string | null;
  /** מספר החיובים שנרשמו (בהוראת קבע: כולל החודשיים) */
  chargeCount: number;
  /** יש עסקה זמנית (בלי מספר אישור מ-Shva): הכסף עדיין לא אושר */
  hasTemporaryPayment: boolean;
};

export type UnmatchedPaymentRow = {
  id: string;
  receivedAt: string;
  kind: string;
  amount: number | null;
  providerTransactionId: string | null;
  providerKevaId: string | null;
  reason: string | null;
  clientName: string | null;
  donationId: string | null;
};

export type DonationsReport = {
  rows: DonationRow[];
  total: number;
  unmatched: UnmatchedPaymentRow[];
};

type PaymentRef = {
  donation_id: string | null;
  provider_transaction_id: string | null;
  received_at: string;
  is_temporary: boolean;
};

type ChargeStats = {
  first: string | null;
  count: number;
  hasTemporary: boolean;
};

function fullName(first: string | null, last: string | null): string | null {
  const name = [first, last].filter(Boolean).join(" ");
  return name || null;
}

async function loadChargeStats(
  donationIds: string[],
): Promise<Map<string, ChargeStats>> {
  const stats = new Map<string, ChargeStats>();
  if (donationIds.length === 0) return stats;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("donation_payments")
    .select("donation_id, provider_transaction_id, received_at, is_temporary")
    .eq("kind", "transaction")
    .in("donation_id", donationIds)
    .order("received_at", { ascending: true });
  if (error) throw new Error(JSON.stringify(describeSupabaseError(error)));

  for (const payment of (data ?? []) as PaymentRef[]) {
    if (!payment.donation_id) continue;
    const current = stats.get(payment.donation_id);
    stats.set(payment.donation_id, {
      first: current?.first ?? payment.provider_transaction_id,
      count: (current?.count ?? 0) + 1,
      hasTemporary: (current?.hasTemporary ?? false) || payment.is_temporary,
    });
  }
  return stats;
}

async function loadUnmatched(): Promise<UnmatchedPaymentRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("donation_payments")
    .select(
      "id, received_at, kind, amount, provider_transaction_id, provider_keva_id, mismatch_reason, donation_id, client_name:raw->>ClientName",
    )
    .eq("matched", false)
    .order("received_at", { ascending: false })
    .limit(UNMATCHED_LIMIT);
  if (error) throw new Error(JSON.stringify(describeSupabaseError(error)));

  return (data ?? []).map((row) => ({
    id: row.id,
    receivedAt: row.received_at,
    kind: row.kind,
    amount: row.amount === null ? null : Number(row.amount),
    providerTransactionId: row.provider_transaction_id,
    providerKevaId: row.provider_keva_id,
    reason: row.mismatch_reason,
    clientName: row.client_name,
    donationId: row.donation_id,
  }));
}

export async function loadDonationsReport(
  query: DonationsQuery,
): Promise<DonationsReport> {
  const supabase = await createClient();
  const from = (query.page - 1) * DONATIONS_PAGE_SIZE;

  let builder = supabase
    .from("donations")
    .select(
      "id, created_at, amount, frequency, status, dedication_text, donor_first_name, donor_last_name, donor_phone, donor_email",
      { count: "exact" },
    );
  if (query.status) builder = builder.eq("status", query.status);

  const { data, count, error } = await builder
    .order("created_at", { ascending: false })
    .range(from, from + DONATIONS_PAGE_SIZE - 1);
  if (error) throw new Error(JSON.stringify(describeSupabaseError(error)));

  const donations = data ?? [];
  const [stats, unmatched] = await Promise.all([
    loadChargeStats(donations.map((donation) => donation.id)),
    loadUnmatched(),
  ]);

  const rows = donations.map((donation): DonationRow => {
    const charge = stats.get(donation.id);
    return {
      id: donation.id,
      createdAt: donation.created_at,
      amount: donation.amount,
      frequency: donation.frequency === "monthly" ? "monthly" : "one_time",
      status: isDonationStatus(donation.status) ? donation.status : "pending",
      dedicationText: donation.dedication_text,
      donorName: fullName(donation.donor_first_name, donation.donor_last_name),
      donorPhone: donation.donor_phone,
      donorEmail: donation.donor_email,
      providerTransactionId: charge?.first ?? null,
      chargeCount: charge?.count ?? 0,
      hasTemporaryPayment: charge?.hasTemporary ?? false,
    };
  });

  return { rows, total: count ?? 0, unmatched };
}
