"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import StudentBox from "./student-box";
import ShiduchAlert from "./shiduch-alert";
import FavoritesGrid from "./favorites-grid";

import { Spinner } from "@/components/ui/spinner";
import calculateAge from "@/lib/calculateAge";
import { Button } from "@/components/ui/button";
import { Save, Send } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type Gender = "male" | "female";

type ShiduchRow = {
  id: string;
  chatanId: string;
  kallahId: string;
  send: boolean;
  created_at?: string;
};

type Props = {
  initialFavorites: any[];
};

export default function ShiduchDesk({ initialFavorites }: Props) {
  const supabase = createClient();
  const router = useRouter();

  const [male, setMale] = useState<any | null>(null);
  const [female, setFemale] = useState<any | null>(null);

  // null = לא מוכנים / לא נבדק, [] = אין שידוך קיים, [rows] = יש שידוך קיים
  const [existing, setExisting] = useState<ShiduchRow[] | null>(null);

  const [shiduchLoading, setShiduchLoading] = useState(false);
  const [draggingGender, setDraggingGender] = useState<Gender | null>(null);

  const [showSendButtons, setShowSendButtons] = useState(false);
  const [favorites, setFavorites] = useState<any[]>(initialFavorites || []);

  // חשוב: אם SSR מתעדכן אחרי router.refresh(), אנחנו רוצים לסנכרן
  useEffect(() => {
    setFavorites(initialFavorites || []);
  }, [initialFavorites]);

  const newShiduch = useMemo(() => {
    if (!male?.id || !female?.id) return null;
    return { chatanId: male.id, kallahId: female.id };
  }, [male?.id, female?.id]);

  // ===== רענון מועדפים מהקליינט (אופציונלי אבל מומלץ) =====
  // זה נותן לך UI עדכני מיידי גם אם SSR עוד לא הגיע.
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
      .select(`*, employment_history(*)`)
      .in("id", favIds);

    if (!error) setFavorites(data || []);
  };

  // נקרא מתוך FavoritesGrid אחרי add/remove
  const handleFavoritesChanged = async () => {
    // ה־Grid כבר עושה router.refresh(), אבל אין בעיה לקרוא גם פה אם תרצה.
    // router.refresh();
    await refetchFavoritesClient();
  };

  // ===== Check shiduch existence (עם הגנה מפני race) =====
  const reqSeq = useRef(0);

  useEffect(() => {
    if (!newShiduch) {
      setExisting(null);
      setShowSendButtons(false);
      return;
    }

    const currentSeq = ++reqSeq.current;

    const checkShiduch = async () => {
      setShiduchLoading(true);
      setShowSendButtons(false);

      const { data, error } = await supabase
        .from("shiduchim")
        .select("id, chatanId, kallahId, send, created_at")
        .eq("chatanId", newShiduch.chatanId)
        .eq("kallahId", newShiduch.kallahId);

      if (currentSeq !== reqSeq.current) return;

      if (error) {
        console.warn(error);
        setExisting(null);
        setShiduchLoading(false);
        setShowSendButtons(false);
        return;
      }

      setExisting(data || []);
      setShiduchLoading(false);
      setShowSendButtons(true);
    };

    checkShiduch();
  }, [newShiduch, supabase]);

  // ===== Drag & Drop =====
  const handleDragEnterTicket = (ev: React.DragEvent) => {
    // אפשר להשתמש בזה אם אתה רוצה הדגשות לפי אזור
    // כרגע לא חובה
    ev.preventDefault();
  };

  const handleDragLeaveTicket = () => { };

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

  // ===== Save / Send =====
  const handelSaveShiduch = async (send: boolean) => {
    if (!newShiduch) return;

    const { data, error } = await supabase
      .from("shiduchim")
      .insert({
        chatanId: newShiduch.chatanId,
        kallahId: newShiduch.kallahId,
        send,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.warn(error);
      alert("שגיאה בשמירת השידוך");
      return;
    }

    alert(send ? "השידוך נשמר ונשלח בהצלחה" : "השידוך נשמר בהצלחה");

    // אופציונלי: אחרי שמירה, אפשר לרענן בדיקה כדי שיזהה שקיים
    router.refresh();
  };

  const mapDoingToday = (person: any) =>
    person.employment_history?.map((emp: any) => {
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

  return (
    <>
      <div className="mx-auto mt-10 grid max-w-[800px] grid-cols-2 gap-4">
        {/* אזור מיועד */}
        <div
          className="border-primary relative min-h-50 rounded-xl border border-dashed bg-[#d7edff] p-2"
          onDragEnter={handleDragEnterTicket}
          onDragLeave={handleDragLeaveTicket}
          onDragOver={handleDragOverTicket}
          onDrop={handleDropTicket}
          data-male
        >
          {draggingGender === "female" && (
            <div className="absolute left-1/2 top-2 -translate-x-1/2 text-sm text-red-600">
              לא ניתן להכניס מיועדת כאן
            </div>
          )}

          {male && (
            <StudentBox
              gender="male"
              firstName={male.first_name}
              lastName={male.last_name}
              age={Number(calculateAge(male.birth_date))}
              city={male.city}
              doingToday={mapDoingToday(male)}
              father={{
                name: `${male.parents_info?.father?.self?.name || ""} ${male.parents_info?.father?.self?.suffix || ""
                  }`.trim(),
                position: male.parents_info?.father?.job || "",
              }}
              mother={{
                name: `${male.parents_info?.mother?.self?.name || ""} ${male.parents_info?.mother?.self?.suffix || ""
                  }`.trim(),
                position: male.parents_info?.mother?.job || "",
                maidenName: male.parents_info?.mother?.maidenName || "",
              }}
              item={male}
              onAddToDesk={setMale}
              onRemoveFromDesk={() => setMale(null)}
            />
          )}
        </div>

        {/* אזור מיועדת */}
        <div
          className="border-primary relative rounded-xl border border-dashed bg-[#ffdddd] p-2"
          onDragEnter={handleDragEnterTicket}
          onDragLeave={handleDragLeaveTicket}
          onDragOver={handleDragOverTicket}
          onDrop={handleDropTicket}
          data-female
        >
          {draggingGender === "male" && (
            <div className="absolute left-1/2 top-2 -translate-x-1/2 text-sm text-red-600">
              לא ניתן להכניס מיועד כאן
            </div>
          )}

          {female && (
            <StudentBox
              gender="female"
              firstName={female.first_name}
              lastName={female.last_name}
              age={Number(calculateAge(female.birth_date))}
              city={female.city}
              doingToday={mapDoingToday(female)}
              father={{
                name: `${female.parents_info?.father?.self?.name || ""} ${female.parents_info?.father?.self?.suffix || ""
                  }`.trim(),
                position: female.parents_info?.father?.job || "",
              }}
              mother={{
                name: `${female.parents_info?.mother?.self?.name || ""} ${female.parents_info?.mother?.self?.suffix || ""
                  }`.trim(),
                position: female.parents_info?.mother?.job || "",
                maidenName: female.parents_info?.mother?.maidenName || "",
              }}
              item={female}
              onAddToDesk={setFemale}
              onRemoveFromDesk={() => setFemale(null)}
            />
          )}
        </div>
      </div>

      {shiduchLoading && <Spinner />}

      {/* Alerts */}
      {existing && existing.length > 0 && (
        <ShiduchAlert
          issues={existing.map(
            (r) => `שידוך קיים (נשמר בתאריך: ${r.created_at || "לא ידוע"})`
          )}
          onClose={() => setExisting([])}
        />
      )}

      {existing && existing.length === 0 && (
        <ShiduchAlert status="ok" onClose={() => setExisting([])} />
      )}

      {showSendButtons && !!newShiduch && (
        <div className="mt-4 flex justify-center gap-4">
          <Button onClick={() => handelSaveShiduch(true)}>
            שליחת ההצעה
            <Send />
          </Button>
          <Button variant="outline" onClick={() => handelSaveShiduch(false)}>
            שמירה כטיוטה (ללא שליחה)
            <Save />
          </Button>
        </div>
      )}

      <FavoritesGrid
        initialFavorites={favorites}
        onAddMale={setMale}
        onAddFemale={setFemale}
        onDragGenderChange={setDraggingGender}
        onFavoritesChanged={handleFavoritesChanged as any}
      />
    </>
  );
}
