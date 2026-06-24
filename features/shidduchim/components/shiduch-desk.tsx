"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import StudentBox from "./student-box";
import type { Student } from "./student-box";
import CompatibilityDiagnosis from "./compatibility-diagnosis";
import SendProposalModal from "./send-proposal-modal";
import type { RecipientScope } from "./send-proposal-modal";
import FavoritesGrid from "./favorites-grid";

import { Spinner } from "@/components/ui/spinner";
import calculateAge from "@/lib/calculateAge";
import { Button } from "@/components/ui/button";
import { Save, Send, User as UserIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getCompatibilityNotes } from "@/features/shidduchim/lib/compatibility";
import { getEffectiveRole } from "@/lib/user-role";

type Gender = "male" | "female";

type PairRow = {
  id: string;
  status: string;
  shadchan_id: string;
  sent_at: string | null;
  created_at: string;
};

type Props = {
  initialFavorites: Student[];
};

function mapDoingToday(person: any): string[] | undefined {
  return person.employment_history?.map((emp: any) => {
    switch (emp.category) {
      case "yeshiva":
        return "בחור ישיבה";
      case "seminar":
        return "לומדת בסמינר";
      case "at_home":
        return "בבית";
      case "havruta":
        return "לומד עם חברותא";
      case "kolel":
        return "כולל";
      case "profession":
        return person.gender === "male" ? "לומד מקצוע" : "לומדת מקצוע";
      case "working":
        return person.gender === "male" ? "עובד" : "עובדת";
      default:
        return "";
    }
  });
}

export default function ShiduchDesk({ initialFavorites }: Props) {
  const supabase = createClient();
  const router = useRouter();

  const [male, setMale] = useState<Student | null>(null);
  const [female, setFemale] = useState<Student | null>(null);

  const [pairRows, setPairRows] = useState<PairRow[] | null>(null);
  const [pairLoading, setPairLoading] = useState(false);
  const [draggingGender, setDraggingGender] = useState<Gender | null>(null);

  const [favorites, setFavorites] = useState<any[]>(initialFavorites || []);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [canOffer, setCanOffer] = useState(false);
  const [hideDiagnosis, setHideDiagnosis] = useState(false);

  const pairReq = useRef(0);

  useEffect(() => {
    setFavorites(initialFavorites || []);
  }, [initialFavorites]);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const r = getEffectiveRole(data.user);
      setCanOffer(r === "shadchan" || r === "admin");
    });
  }, [supabase]);

  const newShiduch = useMemo(() => {
    if (!male?.id || !female?.id) return null;
    return { groomId: male.id, brideId: female.id };
  }, [male?.id, female?.id]);

  const refetchFavoritesClient = async () => {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) return;

    const favIds: string[] = userData?.user?.user_metadata?.favorites || [];
    if (!favIds.length) {
      setFavorites([]);
      return;
    }

    const { data, error } = await supabase
      .from("students")
      .select(`*,employment_history(*),partner_preferences(*)`)
      .in("id", favIds);

    if (!error) setFavorites(data || []);
  };

  const handleFavoritesChanged = async () => {
    await refetchFavoritesClient();
  };

  const fetchPairStatus = async () => {
    if (!newShiduch) {
      setPairRows(null);
      return;
    }

    const seq = ++pairReq.current;
    setPairLoading(true);
    setPairRows(null);

    try {
      const res = await fetch(
        `/api/v1/shidduchim/pair-status?groomId=${encodeURIComponent(newShiduch.groomId)}&brideId=${encodeURIComponent(newShiduch.brideId)}`,
      );
      const data = await res.json();
      if (seq !== pairReq.current) return;
      if (!res.ok) {
        console.warn(data);
        setPairRows([]);
        return;
      }
      setPairRows(data.rows || []);
    } catch (e) {
      console.error(e);
      if (seq === pairReq.current) setPairRows([]);
    } finally {
      if (seq === pairReq.current) setPairLoading(false);
    }
  };

  useEffect(() => {
    setHideDiagnosis(false);
    void fetchPairStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch when pair changes
  }, [newShiduch?.groomId, newShiduch?.brideId]);

  const hasBlockingPair = useMemo(() => {
    if (!pairRows?.length) return false;
    return pairRows.some(
      (r) => r.status !== "draft" && r.status !== "rejected",
    );
  }, [pairRows]);

  const compatibilityIssues = useMemo(() => {
    if (!male || !female) return [];
    return getCompatibilityNotes(male, female, {
      hasNonDraftPair: hasBlockingPair,
    });
  }, [male, female, hasBlockingPair]);

  const handleDragEnterTicket = (ev: React.DragEvent) => {
    ev.preventDefault();
  };

  const handleDragLeaveTicket = () => {};

  const handleDragOverTicket = (ev: React.DragEvent) => {
    ev.preventDefault();
  };

  const handleDropTicket = (ev: React.DragEvent<HTMLDivElement>) => {
    ev.preventDefault();

    const target = ev.currentTarget as HTMLElement;
    const data = ev.dataTransfer.getData("application/json");
    if (!data) return;

    try {
      const parsed: any = JSON.parse(data);
      const isMaleZone = target.dataset.male !== undefined;

      if (isMaleZone && parsed.gender === "male") {
        setMale(parsed);
      } else if (!isMaleZone && parsed.gender === "female") {
        setFemale(parsed);
      } else {
        console.warn("ניסיון לגרור לאזור לא תואם מגדר");
      }
    } catch (err) {
      console.error("Failed to parse dragged item", err);
    } finally {
      setDraggingGender(null);
    }
  };


  const handleSaveDraft = async () => {
    if (!newShiduch || !canOffer) return;
    setDraftLoading(true);
    try {
      const res = await fetch("/api/v1/shidduchim/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groomId: newShiduch.groomId,
          brideId: newShiduch.brideId,
          action: "draft",
          noteForGroom: "",
          noteForBride: "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "שגיאה בשמירה");
        return;
      }
      toast.success("השידוך נשמר כטיוטה");
      router.refresh();
      await fetchPairStatus();
    } finally {
      setDraftLoading(false);
    }
  };

  const handleSendOffer = async ({
    recipientScope,
    noteForGroom,
    noteForBride,
  }: {
    recipientScope: RecipientScope;
    noteForGroom: string;
    noteForBride: string;
  }) => {
    if (!newShiduch || !canOffer) return;
    setSendLoading(true);
    try {
      const res = await fetch("/api/v1/shidduchim/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groomId: newShiduch.groomId,
          brideId: newShiduch.brideId,
          action: "send",
          recipientScope,
          noteForGroom,
          noteForBride,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "שגיאה בשליחה");
        return;
      }
      const list =
        Array.isArray(data.sentTo) && data.sentTo.length > 0
          ? data.sentTo.join(", ")
          : null;
      toast.success(
        list
          ? `נשלח במייל ל: ${list}`
          : "ההצעה נשלחה במייל",
      );
      setSendModalOpen(false);
      router.refresh();
      await fetchPairStatus();
    } finally {
      setSendLoading(false);
    }
  };

  const pairReady = !!newShiduch && !pairLoading && pairRows !== null;

  const actionsDisabled = hasBlockingPair || !canOffer;

  return (
    <>
      <div className="mx-auto mt-4 grid max-w-full grid-cols-1 gap-4 md:mt-10 md:max-w-[800px] md:grid-cols-2">
        {/* Male drop zone */}
        <div
          className="border-primary relative min-h-50 rounded-xl border border-dashed bg-sky-50 p-2"
          onDragEnter={handleDragEnterTicket}
          onDragLeave={handleDragLeaveTicket}
          onDragOver={handleDragOverTicket}
          onDrop={handleDropTicket}
          data-male
        >
          {draggingGender === "female" && (
            <div className="text-destructive absolute top-2 left-1/2 -translate-x-1/2 text-sm">
              לא ניתן להכניס מיועדת כאן
            </div>
          )}

          {male ? (
            <StudentBox
              gender="male"
              firstName={male.first_name}
              lastName={male.last_name}
              age={Number(calculateAge(male.birth_date))}
              city={male.city}
              doingToday={mapDoingToday(male)}
              father={{
                name: `${male.parents_info?.father?.self?.name || ""} ${male.parents_info?.father?.self?.suffix || ""}`.trim(),
                position: male.parents_info?.father?.job || "",
              }}
              mother={{
                name: `${male.parents_info?.mother?.self?.name || ""} ${male.parents_info?.mother?.self?.suffix || ""}`.trim(),
                position: male.parents_info?.mother?.job || "",
                maidenName: male.parents_info?.mother?.maidenName || "",
              }}
              item={male}
            >
              <div className="grid grid-cols-2 gap-2">
                <StudentBox.ViewProfile />
                <StudentBox.RemoveFromDesk onClick={() => setMale(null)} />
              </div>
            </StudentBox>
          ) : (
            <div className="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm">
              <UserIcon className="size-8 opacity-30" />
              <span>גרור מיועד לכאן</span>
            </div>
          )}
        </div>

        {/* Female drop zone */}
        <div
          className="border-primary relative min-h-50 rounded-xl border border-dashed bg-rose-50 p-2"
          onDragEnter={handleDragEnterTicket}
          onDragLeave={handleDragLeaveTicket}
          onDragOver={handleDragOverTicket}
          onDrop={handleDropTicket}
          data-female
        >
          {draggingGender === "male" && (
            <div className="text-destructive absolute top-2 left-1/2 -translate-x-1/2 text-sm">
              לא ניתן להכניס מיועד כאן
            </div>
          )}

          {female ? (
            <StudentBox
              gender="female"
              firstName={female.first_name}
              lastName={female.last_name}
              age={Number(calculateAge(female.birth_date))}
              city={female.city}
              doingToday={mapDoingToday(female)}
              father={{
                name: `${female.parents_info?.father?.self?.name || ""} ${female.parents_info?.father?.self?.suffix || ""}`.trim(),
                position: female.parents_info?.father?.job || "",
              }}
              mother={{
                name: `${female.parents_info?.mother?.self?.name || ""} ${female.parents_info?.mother?.self?.suffix || ""}`.trim(),
                position: female.parents_info?.mother?.job || "",
                maidenName: female.parents_info?.mother?.maidenName || "",
              }}
              item={female}
            >
              <div className="grid grid-cols-2 gap-2">
                <StudentBox.ViewProfile />
                <StudentBox.RemoveFromDesk onClick={() => setFemale(null)} />
              </div>
            </StudentBox>
          ) : (
            <div className="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm">
              <UserIcon className="size-8 opacity-30" />
              <span>גרור מיועדת לכאן</span>
            </div>
          )}
        </div>
      </div>

      {pairLoading && !!newShiduch && (
        <div className="mt-6 flex justify-center">
          <Spinner />
        </div>
      )}

      {pairReady && (
        <>
          {!hideDiagnosis && (
            <div className="mt-6">
              <CompatibilityDiagnosis
                issues={compatibilityIssues}
                onDismiss={() => setHideDiagnosis(true)}
              />
            </div>
          )}

          {canOffer && (
            <>
              <div className="mt-4 flex flex-wrap justify-center gap-4">
                <Button
                  onClick={() => setSendModalOpen(true)}
                  disabled={actionsDisabled || sendLoading || draftLoading}
                >
                  שלח הצעה
                  <Send className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={actionsDisabled || sendLoading || draftLoading}
                >
                  {draftLoading ? "שומר…" : "שמירה ללא שליחה"}
                  <Save className="size-4" />
                </Button>
              </div>

              {hasBlockingPair && (
                <p className="text-muted-foreground mt-3 text-center text-sm">
                  לצמד זה כבר קיימת הצעה במערכת — לא ניתן לשמור או לשלוח שוב.
                </p>
              )}
            </>
          )}

          {!canOffer && (
            <p className="text-muted-foreground mt-4 text-center text-sm">
              שליחת הצעות ושמירת טיוטות זמינות לשדכנים ולמנהלים בלבד.
            </p>
          )}
        </>
      )}

      <SendProposalModal
        open={sendModalOpen}
        onOpenChange={setSendModalOpen}
        onConfirm={handleSendOffer}
        loading={sendLoading}
      />

      <FavoritesGrid
        initialFavorites={favorites}
        onAddMale={setMale}
        onAddFemale={setFemale}
        onDragGenderChange={setDraggingGender}
        onFavoritesChanged={handleFavoritesChanged}
      />
    </>
  );
}
