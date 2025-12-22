"use client";
import { Activity, useContext, useState } from "react";
import { QueryContext, useStudentQuery, StudentQuery } from "../page";
import { Box, DashboardSection } from "@/components/layout";
import { TextField } from "../create/form/fields/text";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, Sliders } from "lucide-react";
import { SelectField } from "../create/form/fields/select";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import Link from "next/link";

export default function FilterSection() {
  const { query, setQuery } = useStudentQuery();
  const [filter, setFilter] = useState<StudentQuery>({});
  const [expanded, setExpanded] = useState(false);

  const [gender, setGender] = useState("male");

  return (
    <DashboardSection
      title="רשימת פרחי אנ״ש"
      button={
        <Button asChild>
          <Link href={"/app"}>לכל ההצעות האחרונות</Link>
        </Button>
      }
      containerClassName="p-0 space-y-4"
    >
      <div className="box grid grid-cols-12 gap-4 p-4">
        <div className="col-span-2">
          <Label htmlFor="gender">מגדר</Label>
          <NativeSelect
            id="gender"
            value={filter.gender || ""}
            onChange={(e) => setFilter({ ...filter, gender: e.target.value })}
          >
            <NativeSelectOption value="">הכל</NativeSelectOption>
            <NativeSelectOption value={"male"}>זכר</NativeSelectOption>
            <NativeSelectOption value={"female"}>נקבה</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="col-span-2">
          <Label htmlFor="status">סטטוס</Label>
          <NativeSelect
            id="status"
            value={filter.personal_status || ""}
            onChange={(e) =>
              setFilter({ ...filter, personal_status: e.target.value })
            }
          >
            <NativeSelectOption value="">הכל</NativeSelectOption>
            <NativeSelectOption value="divorced">גרוש/ה</NativeSelectOption>
            <NativeSelectOption value="widowed">אלמן/ה</NativeSelectOption>
            <NativeSelectOption value="single">רווק/ה</NativeSelectOption>
            <NativeSelectOption value="married">נשוי/ה</NativeSelectOption>
            <NativeSelectOption value="engaged">מאורס/ה</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="col-span-2">
          <Label htmlFor="firstName">שם פרטי</Label>
          <TextField
            type="text"
            id="firstName"
            onChange={(e) =>
              setFilter({ ...filter, first_name: e.target.value })
            }
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="lastName">שם משפחה</Label>
          <TextField
            type="text"
            id="lastName"
            onChange={(e) =>
              setFilter({ ...filter, last_name: e.target.value })
            }
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="ageMin">טווח גילאים</Label>
          <TextField
            type="number"
            id="ageMin"
            onChange={(e) => setFilter({ ...filter, ageMin: e.target.value })}
          />
        </div>
        <Activity mode={expanded ? "visible" : "hidden"}>
          <div className="col-span-2">
            <Label htmlFor="height">גובה (בס״מ)</Label>
            <TextField
              type="number"
              id="height"
              onChange={(e) => setFilter({ ...filter, height: e.target.value })}
            />
          </div>
          <div className="col-span-3">
            <Label htmlFor="fatherName">שם האב</Label>
            <TextField
              type="text"
              id="fatherName"
              onChange={(e) =>
                setFilter({ ...filter, father_name: e.target.value })
              }
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="city">עיר</Label>
            <TextField
              type="text"
              id="city"
              onChange={(e) => setFilter({ ...filter, city: e.target.value })}
            />
          </div>
          <div className="col-span-3">
            <Label htmlFor="employment">תעסוקה</Label>
            <TextField
              type="text"
              id="employment"
              onChange={(e) =>
                setFilter({ ...filter, employment: e.target.value })
              }
            />
          </div>
          <div className="col-span-4">
            <Label htmlFor="institutions">מקום לימודים</Label>
            <TextField
              type="text"
              id="institutions"
              onChange={(e) =>
                setFilter({ ...filter, yeshiva_name: e.target.value })
              }
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="yeshiva">תלמיד / בוגר ישיבה</Label>
            <NativeSelect
              id="yeshiva"
              value={
                filter.is_yeshiva === undefined ? "" : String(filter.is_yeshiva)
              }
              onChange={(e: any) =>
                setFilter({ ...filter, is_yeshiva: e.target.value })
              }
            >
              <NativeSelectOption value="">הכל</NativeSelectOption>
              <NativeSelectOption value="true">כן</NativeSelectOption>
              <NativeSelectOption value="false">לא</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="col-span-2">
            <Label htmlFor="reservoir">לבחירה מתוך המאגר</Label>
            <NativeSelect
              size="default"
              id="reservoir"
              value={
                filter.is_reservoir === undefined
                  ? ""
                  : String(filter.is_reservoir)
              }
              onChange={(e: any) =>
                setFilter({
                  ...filter,
                  is_reservoir: e.target.value === "true",
                })
              }
              className="w-full"
            >
              <NativeSelectOption value="">הכל</NativeSelectOption>
              <NativeSelectOption value="true">כן</NativeSelectOption>
              <NativeSelectOption value="false">לא</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="col-span-2">
            <Label htmlFor="yeshivaName">שם הישיבה</Label>
            <TextField
              type="text"
              id="yeshivaName"
              onChange={(e) =>
                setFilter({ ...filter, yeshiva_name: e.target.value })
              }
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="yeshivaCity">עיר</Label>
            <TextField
              type="text"
              id="yeshivaCity"
              onChange={(e) =>
                setFilter({ ...filter, yeshiva_city: e.target.value })
              }
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="class">שיעור / כיתה</Label>
            <TextField
              type="text"
              id="class"
              onChange={(e) => setFilter({ ...filter, class: e.target.value })}
            />
          </div>
        </Activity>
        <div className="col-span-2 flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => setExpanded((expanded) => !expanded)}
          >
            <Sliders />
            <span className="sr-only">הצג עוד מסננים</span>
          </Button>
          <Button onClick={() => setQuery(filter)} className="ml-2 flex-1">
            חיפוש
            <Search />
          </Button>
        </div>
      </div>
    </DashboardSection>
  );
}
