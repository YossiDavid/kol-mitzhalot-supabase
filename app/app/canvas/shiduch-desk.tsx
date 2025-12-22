"use client";

import { useEffect, useState } from "react";
import StudentBox from "./student-box";
import ShiduchAlert from "./shiduch-alert";
import { Spinner } from "@/components/ui/spinner";
import calculateAge from "@/lib/calculateAge";
import { Button } from "@/components/ui/button";
import { Save, Send } from "lucide-react";
import FavoritesGrid from "./favorites-grid";

type Props = {
  favorites: any[];
};

export default function ShiduchDesk({ favorites }: Props) {
  const [issues, setIssues] = useState<string[] | false>([]);
  const [male, setMale] = useState<any | null>(null);
  const [female, setFemale] = useState<any | null>(null);
  const [newShiduch, setNewShiduch] = useState<any | null>(null);
  const [shiduchLoading, setShiduchLoading] = useState(false);
  const [maleDrop, setMaleDrop] = useState(false);
  const [femaleDrop, setfemaleDrop] = useState(false);
  const [draggingGender, setDraggingGender] = useState<
    "male" | "female" | null
  >(null);
  const [showSendButtons, setShowSendButtons] = useState(false);

  // ברגע שיש שני צדדים – עדכן newShiduch
  useEffect(() => {
    if (male && female) {
      setNewShiduch({ chatanId: male.id, kallahId: female.id });
    }
  }, [male, female]);

  // שליחת בדיקה לשרת
  useEffect(() => {
    const checkShiduch = async () => {
      try {
        setShiduchLoading(true);

        const response = await fetch("/api/shiduchim/new-shiduch/check", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ newShiduch }),
        });

        const data = await response.json();

        if (data.length > 0) setIssues(data);
        if (data.length === 0) setIssues(false);

        console.log(data);
        setShiduchLoading(false);
        setShowSendButtons(true);
      } catch (error) {
        console.warn(error);
      }
    };

    if (newShiduch !== null) checkShiduch();
  }, [newShiduch]);

  // Drag & Drop
  const handleDragEnterTicket = (ev: DragEvent | React.DragEvent) => {
    const target = ev.target as HTMLElement;
    const isMaleDrop = !!target.dataset.male;
    setMaleDrop(isMaleDrop);
    setfemaleDrop(!isMaleDrop);
  };

  const handleDragLeaveTicket = (ev: any) => {
    ev.target.classList.remove("drag-hover");
  };

  const handleDragOverTicket = (ev: any) => {
    ev.preventDefault();
  };

  const handleDropTicket = (ev: React.DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
    const target = ev.currentTarget as HTMLElement;
    const data = ev.dataTransfer.getData("application/json");
    if (!data) return;

    try {
      const parsed: any = JSON.parse(data);
      const isTargetMale = target.dataset.male !== undefined;
      const isDraggingMale = parsed.gender === "male";

      if (isTargetMale && isDraggingMale) {
        setMale(parsed);
      } else if (!isTargetMale && parsed.gender === "female") {
        setFemale(parsed);
      } else {
        console.warn("ניסיון לגרור לאזור לא תואם מגדר");
      }
    } catch (err) {
      console.error("Failed to parse dragged item", err);
    }

    setfemaleDrop(false);
    setMaleDrop(false);
  };

  const handelSaveShiduch = async (send: boolean) => {
    const req = await fetch("api/shiduchim/new", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chatanId: newShiduch?.chatanId,
        kallahId: newShiduch?.kallahId,
        send,
      }),
    });

    const res = await req.json();

    console.log(newShiduch);
    console.log(res);
    send ? alert("השידוך נשמר ונשלח בהצלחה") : alert("השידוך נשמר בהצלחה");
  };

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
            <div className="absolute top-2 left-1/2 -translate-x-1/2 text-sm text-red-600">
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
              doingToday={male.employment_history?.map((emp: any) => {
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
                    return male.gender === "male"
                      ? "לומד מקצוע"
                      : "לומדת מקצוע";
                  case "working":
                    return male.gender === "male" ? "עובד" : "עובדת";
                  default:
                    return "";
                }
              })}
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
            <div className="absolute top-2 left-1/2 -translate-x-1/2 text-sm text-red-600">
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
              doingToday={female.employment_history?.map((emp: any) => {
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
                    return female.gender === "male"
                      ? "לומד מקצוע"
                      : "לומדת מקצוע";
                  case "working":
                    return female.gender === "male" ? "עובד" : "עובדת";
                  default:
                    return "";
                }
              })}
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
              onAddToDesk={setFemale}
              onRemoveFromDesk={() => setFemale(null)}
            />
          )}
        </div>
      </div>

      {/* אינדיקציה */}
      {shiduchLoading && <Spinner />}

      {/* בעיות */}
      {issues && issues?.length > 0 && (
        <ShiduchAlert
          issues={issues as string[]}
          onClose={() => setIssues([])}
        />
      )}
      {!issues && <ShiduchAlert status="ok" onClose={() => setIssues(false)} />}

      {showSendButtons && (
        <div className="mt-4 flex justify-center gap-4">
          <Button onClick={() => handelSaveShiduch(true)}>
            שליחת ההצעה
            <Send />
          </Button>
          <Button variant={"outline"} onClick={() => handelSaveShiduch(false)}>
            שמירה כטיוטה (ללא שליחה)
            <Save />
          </Button>
        </div>
      )}

      {/* גריד פייבוריטס */}
      <FavoritesGrid
        initialFavorites={favorites}
        onAddMale={setMale}
        onAddFemale={setFemale}
      />
    </>
  );
}
