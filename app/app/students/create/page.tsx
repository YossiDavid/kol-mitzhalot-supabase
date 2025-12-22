"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Box, Section } from "@/components/layout";
import { cn } from "@/lib/utils";
import { studentFields } from "./form/fileds-data";
import { DynamicField } from "./form/fields/dynamic-field";
import { createClient } from "@/lib/supabase/client";

type Step = (typeof studentFields)[number];

const defaultValues = {
  isOnShiduchim: true,
  gender: "",
  firstName: "",
  lastName: "",
  identityNumber: "",
  birthDate: "",
  image: {
    file: null as File | null,
  },
  country: "",
  city: "",
  street: "",
  house: "",
  community: "",
  shtible: "",
  personalStatus: "",
  height: "",
  cellphoneType: "",
  phone: "",
  planForLife: "",
  headCoverType: "",
  about: "",
  cv: {
    file: null as File | null,
  },
  father: {
    self: { prefix: "", name: "", suffix: "" },
    phone: "",
    job: "",
    email: "",
    grandFather: { prefix: "", name: "", suffix: "" },
    grandMother: { prefix: "", name: "", suffix: "" },
  },
  mother: {
    self: { prefix: "", name: "", suffix: "" },
    maidenName: "",
    phone: "",
    job: "",
    email: "",
    grandFather: { prefix: "", name: "", suffix: "" },
    grandMother: { prefix: "", name: "", suffix: "" },
  },
  family: {
    numberOfChildren: "",
    currentChildPlace: "",
    about: "",
    mechutanim: [] as Array<{
      id?: string;
      firstName?: string;
      lastName?: string;
      city?: string;
    }>,
  },
  education: {
    yeshivaKtana: [] as Array<{
      id?: string;
      name?: string;
      community?: string;
      city?: string;
    }>,
    yeshivaGdola: [] as Array<{
      id?: string;
      name?: string;
      community?: string;
      city?: string;
    }>,
    kolel: [] as Array<{
      id?: string;
      name?: string;
      community?: string;
      city?: string;
    }>,
    seminar: [] as Array<{
      id?: string;
      name?: string;
      community?: string;
      city?: string;
    }>,
  },
  employment: {
    tags: [] as string[],
    yeshiva: "",
    kolel: "",
    seminar: "",
    havruta: {
      with: "",
      where: "",
    },
    working: {
      role: "",
      where: "",
    },
    profession: {
      what: "",
      where: "",
    },
  },
  previousPartners: [] as Array<Record<string, unknown>>,
  knownRabbanim: [] as Array<Record<string, unknown>>,
  knownFriends: [] as Array<Record<string, unknown>>,
  knownFamilyFriends: [] as Array<Record<string, unknown>>,
  parents: {
    status: "",
    holding: "",
    deadParent: "",
    fatherDeathDate: "",
    motherDeathDate: "",
    isMotherRemarried: "",
    newHusbandName: "",
    isFatherRemarried: "",
    newWifeName: "",
  },
  medical: {
    status: "",
    exposureLevel: "",
    details: "",
    documents: [] as File[],
    contactForMoreInfo: "",
    otherContact: [] as Array<Record<string, unknown>>,
    relatedIssuePreference: "",
  },
  partner: {
    ageRange: { min: 18, max: 40 },
    preferredCountry: "",
    specificCountries: [] as Array<Record<string, unknown>>,
    workStatus: "",
    headCoverType: "",
    planForLife: "",
    cellphoneType: "",
    aboutThePartner: "",
    additionalInformation: "",
  },
  author: {
    name: "",
    phone: "",
  },
};

type FormValues = typeof defaultValues;

const genderLabelOverrides: Record<string, { male: string; female: string }> = {
  "previousPartners.fullName": {
    male: "שם מלא של האשה הקודמת",
    female: "שם מלא של הבעל הקודם",
  },
  "previousPartners.parents.fathersName": {
    male: "שם האב של האשה",
    female: "שם האב של הבעל",
  },
  "previousPartners.parents.mothersName": {
    male: "שם האם של האשה",
    female: "שם האם של הבעל",
  },
  "previousPartners.childrenNumber": {
    male: "מספר ילדים מנישואין אלו",
    female: "מספר ילדים מנישואין אלו",
  },
  "previousPartners.marriedChildrenNumber": {
    male: "מתוכם נשואים",
    female: "מתוכם נשואות",
  },
};

const genderedStepTitles: Record<string, { male: string; female: string }> = {
  previousPartners: {
    male: "פרטי אשה קודמת",
    female: "פרטי בעל קודם",
  },
  partner: {
    male: "קצת על המיועדת שאתם מחפשים",
    female: "קצת על המיועד שאתם מחפשים",
  },
};

const supabase = createClient();

export default function CreateStudentPage() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    mode: "onChange",
    defaultValues,
  });

  const formValues = form.watch();

  useEffect(() => {
    if (typeof window === "undefined") return;
    console.log("Form values changed:", formValues);
  }, [formValues]);

  const steps = studentFields;
  const currentStep = steps[currentStepIndex];
  const gender = formValues.gender as "male" | "female" | "";
  const isLastStep = currentStepIndex === steps.length - 1;

  const canProceedFromCurrentStep = () => {
    if (steps[currentStepIndex]?.name === "intro") {
      const selectedGender = form.getValues("gender");
      if (!selectedGender) {
        form.setError("gender", {
          type: "manual",
          message: "יש לבחור מיועד/מיועדת לפני שממשיכים",
        });
        return false;
      }
      form.clearErrors("gender");
    }

    return true;
  };

  const handleNextStep = () => {
    if (!canProceedFromCurrentStep()) return;
    if (currentStepIndex === steps.length - 1) return;
    setCurrentStepIndex((prev) => prev + 1);
  };

  const handlePreviousStep = () => {
    if (currentStepIndex === 0) return;
    setCurrentStepIndex((prev) => prev - 1);
  };

  const handleStepClick = (targetIndex: number) => {
    if (targetIndex === currentStepIndex) return;
    const movingForward = targetIndex > currentStepIndex;
    if (movingForward && !canProceedFromCurrentStep()) {
      return;
    }
    setCurrentStepIndex(targetIndex);
  };

  // פונקציה להמרת תאריך לפורמט ISO (YYYY-MM-DD)
  const formatDateToISO = (
    dateString: string | null | undefined,
  ): string | null => {
    if (!dateString || dateString.trim() === "") {
      return null;
    }

    // אם התאריך כבר בפורמט ISO (YYYY-MM-DD), החזר אותו
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }

    // נסה לפרסר תאריכים בפורמטים שונים
    // פורמט DD/MM/YYYY
    const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateString);
    if (ddmmyyyy) {
      const day = ddmmyyyy[1].padStart(2, "0");
      const month = ddmmyyyy[2].padStart(2, "0");
      const year = ddmmyyyy[3];
      return `${year}-${month}-${day}`;
    }

    // פורמט DD-MM-YYYY
    const ddmmyyyy2 = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(dateString);
    if (ddmmyyyy2) {
      const day = ddmmyyyy2[1].padStart(2, "0");
      const month = ddmmyyyy2[2].padStart(2, "0");
      const year = ddmmyyyy2[3];
      return `${year}-${month}-${day}`;
    }

    // נסה להשתמש ב-Date object
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
    } catch (e) {
      console.warn("Failed to parse date:", dateString, e);
    }

    // אם כלום לא עבד, החזר null
    console.warn("Could not parse date format:", dateString);
    return null;
  };

  // פונקציה לניקוי שם קובץ מתווים לא תקינים
  const sanitizeFileName = (fileName: string): string => {
    if (!fileName || fileName.trim().length === 0) {
      return "file";
    }

    // מחלץ את הסיומת
    const lastDot = fileName.lastIndexOf(".");
    const name = lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
    const ext = lastDot > 0 ? fileName.substring(lastDot).toLowerCase() : "";

    // מנקה את השם: מסיר תווים מיוחדים, מחליף רווחים, ומקצר
    // חשוב: Supabase Storage לא מקבל תווים עבריים ב-URL, אז נסיר אותם
    let sanitized = name
      .replace(/[\u0590-\u05FF]/g, "") // מסיר תווים עבריים
      .replace(/[^a-zA-Z0-9\-_]/g, "-") // שומר רק אותיות, מספרים, מקפים ותחתיות
      .replace(/\s+/g, "-") // מחליף רווחים במקפים
      .replace(/-+/g, "-") // מסיר מקפים כפולים
      .replace(/^-|-$/g, "") // מסיר מקפים מהתחלה וסוף
      .substring(0, 100); // מגביל ל-100 תווים

    // אם השם המנוקה ריק (למשל אם היה רק עברית), משתמש בשם ברירת מחדל
    if (!sanitized || sanitized.length === 0) {
      sanitized = "file";
    }

    return sanitized + ext;
  };

  const onSubmit = async (values: FormValues) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      console.log("Submit payload:", values);

      // בדיקת אימות משתמש
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        console.error("User not authenticated", authError);
        alert("שגיאה: יש להתחבר למערכת");
        return;
      }

      // 1. בניית ה-payload לפי הסכמה (ללא URLs - נשלח null)
      // מיפוי ערכים מהטופס ל-enum types במסד הנתונים
      // Enum Types במסד הנתונים:
      // - gender_enum: male, female
      // - personal_status_enum: single, divorced, widower
      // - cellphone_type_enum: kosher, sms, protected_smartphone, other
      // - head_cover_type_enum: kerchief, wig, kerchief_on_wig, other
      // - plan_for_life_enum: koilel, torah_job, mix_torah_work, work
      // - medical_status_enum: good, littleProblem, hugeProblem
      // - education_type_enum: yeshiva_ktana, yeshiva_gdola, kolel, seminar
      // - reference_type_enum: rabbi, friend, family_friend
      const mapPersonalStatus = (status: string): string => {
        // personal_status_enum: single, divorced, widower
        // בטופס יש "divorce" אבל ב-enum זה "divorced"
        if (status === "divorce") return "divorced";
        return status; // single, widower כבר תואמים
      };

      const payload = {
        user_id: user.id,
        first_name: values.firstName,
        last_name: values.lastName,
        identity_number: values.identityNumber,
        birth_date: formatDateToISO(values.birthDate),
        gender: values.gender, // gender_enum: male, female
        personal_status: mapPersonalStatus(values.personalStatus),
        height: values.height ? parseFloat(values.height) : null,
        phone: values.phone,
        country: values.country,
        city: values.city,
        street: values.street,
        house: values.house,
        community: values.community || null,
        shtible: values.shtible || null,
        cellphone_type: values.cellphoneType,
        plan_for_life: values.planForLife || null,
        head_cover_type: values.headCoverType || null,
        image_url: null, // יועלה אחרי יצירת הסטודנט
        cv_url: null, // יועלה אחרי יצירת הסטודנט
        about: values.about || null,
        parents_info: {
          father: {
            self: {
              prefix: values.father?.self?.prefix || "",
              name: values.father?.self?.name || "",
              suffix: values.father?.self?.suffix || "",
            },
            phone: values.father?.phone || "",
            job: values.father?.job || "",
            email: values.father?.email || "",
            grandFather: {
              prefix: values.father?.grandFather?.prefix || "",
              name: values.father?.grandFather?.name || "",
              suffix: values.father?.grandFather?.suffix || "",
            },
            grandMother: {
              prefix: values.father?.grandMother?.prefix || "",
              name: values.father?.grandMother?.name || "",
              suffix: values.father?.grandMother?.suffix || "",
            },
          },
          mother: {
            self: {
              prefix: values.mother?.self?.prefix || "",
              name: values.mother?.self?.name || "",
              suffix: values.mother?.self?.suffix || "",
            },
            maidenName: values.mother?.maidenName || "",
            phone: values.mother?.phone || "",
            job: values.mother?.job || "",
            email: values.mother?.email || "",
            grandFather: {
              prefix: values.mother?.grandFather?.prefix || "",
              name: values.mother?.grandFather?.name || "",
              suffix: values.mother?.grandFather?.suffix || "",
            },
            grandMother: {
              prefix: values.mother?.grandMother?.prefix || "",
              name: values.mother?.grandMother?.name || "",
              suffix: values.mother?.grandMother?.suffix || "",
            },
          },
          status: values.parents?.status || null,
          holding: values.parents?.holding || null,
          deadParent: values.parents?.deadParent || null,
          fatherDeathDate:
            formatDateToISO(values.parents?.fatherDeathDate) || null,
          motherDeathDate:
            formatDateToISO(values.parents?.motherDeathDate) || null,
          isMotherRemarried: values.parents?.isMotherRemarried || null,
          newHusbandName: values.parents?.newHusbandName || null,
          isFatherRemarried: values.parents?.isFatherRemarried || null,
          newWifeName: values.parents?.newWifeName || null,
        },
        family_info: {
          numberOfChildren: values.family?.numberOfChildren
            ? parseInt(values.family.numberOfChildren)
            : null,
          currentChildPlace: values.family?.currentChildPlace
            ? parseInt(values.family.currentChildPlace)
            : null,
          about: values.family?.about || null,
          mechutanim: (values.family?.mechutanim || []).map((m) => ({
            id: m.id || null,
            firstName: m.firstName || null,
            lastName: m.lastName || null,
            city: m.city || null,
          })),
        },
        author_info: {
          name: values.author?.name || "",
          phone: values.author?.phone || "",
        },
        education_history: [
          ...(values.education?.yeshivaKtana || []).map((e) => ({
            institution_type: "yeshiva_ktana",
            name: e.name || "",
            community: e.community || null,
            city: e.city || null,
          })),
          ...(values.education?.yeshivaGdola || []).map((e) => ({
            institution_type: "yeshiva_gdola",
            name: e.name || "",
            community: e.community || null,
            city: e.city || null,
          })),
          ...(values.education?.kolel || []).map((e) => ({
            institution_type: "kolel",
            name: e.name || "",
            community: e.community || null,
            city: e.city || null,
          })),
          ...(values.education?.seminar || []).map((e) => ({
            institution_type: "seminar",
            name: e.name || "",
            community: e.community || null,
            city: e.city || null,
          })),
        ],
        employment_history: [
          ...(values.employment?.tags?.includes("yeshiva") &&
          values.employment.yeshiva
            ? [
                {
                  category: "yeshiva",
                  role: null,
                  location: values.employment.yeshiva,
                  description: null,
                },
              ]
            : []),
          ...(values.employment?.tags?.includes("kolel") &&
          values.employment.kolel
            ? [
                {
                  category: "kolel",
                  role: null,
                  location: values.employment.kolel,
                  description: null,
                },
              ]
            : []),
          ...(values.employment?.tags?.includes("seminar") &&
          values.employment.seminar
            ? [
                {
                  category: "seminar",
                  role: null,
                  location: values.employment.seminar,
                  description: null,
                },
              ]
            : []),
          ...(values.employment?.tags?.includes("havruta") &&
          values.employment.havruta?.with
            ? [
                {
                  category: "havruta",
                  role: values.employment.havruta.with,
                  location: values.employment.havruta.where || null,
                  description: null,
                },
              ]
            : []),
          ...(values.employment?.tags?.includes("working") &&
          values.employment.working?.role
            ? [
                {
                  category: "working",
                  role: values.employment.working.role,
                  location: values.employment.working.where || null,
                  description: null,
                },
              ]
            : []),
          ...(values.employment?.tags?.includes("profession") &&
          values.employment.profession?.what
            ? [
                {
                  category: "profession",
                  role: values.employment.profession.what,
                  location: values.employment.profession.where || null,
                  description: null,
                },
              ]
            : []),
        ],
        medical_records:
          values.medical?.status && values.medical.status !== "good"
            ? {
                status: values.medical.status,
                exposure_level: values.medical.exposureLevel || null,
                details: values.medical.details || null,
                documents: [], // יועלו אחרי יצירת הסטודנט
                contact_info:
                  values.medical.contactForMoreInfo === "parents"
                    ? { type: "parents" }
                    : values.medical.contactForMoreInfo === "other_contact" &&
                        values.medical.otherContact
                      ? {
                          type: "other",
                          contacts: values.medical.otherContact.map(
                            (c: any) => ({
                              name: c.name || "",
                              phone: c.phone || "",
                              email: c.email || null,
                            }),
                          ),
                        }
                      : null,
                related_issue_preference:
                  values.medical.relatedIssuePreference || null,
              }
            : null,
        partner_preferences: {
          age_min: values.partner?.ageRange?.min || null,
          age_max: values.partner?.ageRange?.max || null,
          preferred_countries:
            values.partner?.preferredCountry === "all"
              ? []
              : values.partner?.specificCountries
                  ?.map((c: any) => c.name || c.locale || "")
                  .filter(Boolean) || [],
          work_status: values.partner?.workStatus || null,
          head_cover_type: values.partner?.headCoverType || null,
          plan_for_life: values.partner?.planForLife || null,
          cellphone_type: values.partner?.cellphoneType || null,
          about_partner: values.partner?.aboutThePartner || null,
          additional_information: values.partner?.additionalInformation || null,
        },
        references: [
          ...(values.knownRabbanim || []).map((r: any) => ({
            reference_type: "rabbi",
            name: r.name || "",
            phone: r.phone || "",
            email: null,
          })),
          ...(values.knownFriends || []).map((f: any) => ({
            reference_type: "friend",
            name: f.name || "",
            phone: f.phone || "",
            email: f.email || null,
          })),
          ...(values.knownFamilyFriends || []).map((ff: any) => ({
            reference_type: "family_friend",
            name: ff.name || "",
            phone: ff.phone || "",
            email: ff.email || null,
          })),
        ],
        previous_partners: (values.previousPartners || []).map((p: any) => ({
          separation_type: p.separationType || null,
          full_name: p.fullName || null,
          marriage_date: formatDateToISO(p.marriageDate) || null,
          divorce_date: formatDateToISO(p.divorce?.date) || null,
          death_date: formatDateToISO(p.deathDate) || null,
          children_number: p.childrenNumber ? parseInt(p.childrenNumber) : null,
          divorce_details:
            p.separationType === "divorce"
              ? {
                  reason: p.divorce?.reason || null,
                  rabbiName: p.divorce?.rabbiName || null,
                  rabbiPhone: p.divorce?.rabbiPhone || null,
                }
              : null,
        })),
      };

      // 2. יצירת הסטודנט (ללא URLs)
      // הערה: ודא/י שהשם של הפונקציה ב-Supabase תואם (ייתכן שצריך לשנות ל-"create_full_student_profile" או שם אחר)
      const { data: studentData, error: createError } = await supabase.rpc(
        "create_full_student_profile",
        {
          payload: payload as any,
        },
      );

      if (createError) {
        console.error("Failed creating student:", createError);
        alert(`שגיאה בשמירת הקו״ח: ${createError.message}`);
        setIsSubmitting(false);
        return;
      }

      // studentData הוא ה-student_id (UUID)
      const studentId = studentData;
      if (!studentId) {
        console.error("No student ID returned from function");
        alert("שגיאה: לא התקבל מזהה סטודנט");
        setIsSubmitting(false);
        return;
      }

      console.log("Student created successfully with ID:", studentId);

      // 3. העלאת קבצים ל-Storage (לפי student_id)
      let imageUrl: string | null = null;
      let cvUrl: string | null = null;
      const medicalDocumentUrls: string[] = [];
      let hasUploadErrors = false;

      // העלאת תמונה
      if (values.image?.file) {
        const imageFile = values.image.file;
        const sanitizedFileName = sanitizeFileName(imageFile.name);
        const imageExt = sanitizedFileName.split(".").pop() || "jpg";
        const imagePath = `${studentId}/${Date.now()}-image.${imageExt}`;

        const { data: imageData, error: imageError } = await supabase.storage
          .from("students")
          .upload(imagePath, imageFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: imageFile.type,
          });

        if (imageError) {
          console.error("Error uploading image:", imageError);
          hasUploadErrors = true;
          // נמשיך גם אם העלאת תמונה נכשלה - נעדכן את הסטודנט בלי תמונה
          // המשתמש יוכל לעדכן את התמונה מאוחר יותר
        } else {
          // יצירת signed URL (תוקף 1 שנה) במקום public URL
          const { data: signedUrlData } = await supabase.storage
            .from("students")
            .createSignedUrl(imagePath, 31536000); // 1 שנה בשניות
          if (signedUrlData) {
            imageUrl = signedUrlData.signedUrl;
          }
        }
      }

      // העלאת קורות חיים
      if (values.cv?.file) {
        const cvFile = values.cv.file;
        const sanitizedFileName = sanitizeFileName(cvFile.name);
        const cvExt = sanitizedFileName.split(".").pop() || "pdf";
        const cvPath = `${studentId}/${Date.now()}-cv.${cvExt}`;

        const { data: cvData, error: cvError } = await supabase.storage
          .from("students")
          .upload(cvPath, cvFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: cvFile.type,
          });

        if (cvError) {
          console.error("Error uploading CV:", cvError);
          hasUploadErrors = true;
          // נמשיך גם אם העלאת CV נכשלה - נעדכן את הסטודנט בלי CV
          // המשתמש יוכל לעדכן את ה-CV מאוחר יותר
        } else {
          // יצירת signed URL (תוקף 1 שנה) במקום public URL
          const { data: signedUrlData } = await supabase.storage
            .from("students")
            .createSignedUrl(cvPath, 31536000); // 1 שנה בשניות
          if (signedUrlData) {
            cvUrl = signedUrlData.signedUrl;
          }
        }
      }

      // העלאת מסמכים רפואיים
      if (
        values.medical?.documents &&
        Array.isArray(values.medical.documents) &&
        values.medical.documents.length > 0
      ) {
        for (const doc of values.medical.documents) {
          if (doc instanceof File) {
            const sanitizedFileName = sanitizeFileName(doc.name);
            const docExt = sanitizedFileName.split(".").pop() || "pdf";
            const docPath = `${studentId}/medical/${Date.now()}-${sanitizedFileName}`;

            const { data: docData, error: docError } = await supabase.storage
              .from("students")
              .upload(docPath, doc, {
                cacheControl: "3600",
                upsert: false,
                contentType: doc.type,
              });

            if (docError) {
              console.error("Error uploading medical document:", docError);
              if (docError.message.includes("row-level security")) {
                console.warn(
                  "RLS policy error for medical document. Continuing without this document.",
                );
              }
              continue;
            }

            // יצירת signed URL (תוקף 1 שנה) במקום public URL
            const { data: signedUrlData } = await supabase.storage
              .from("students")
              .createSignedUrl(docPath, 31536000); // 1 שנה בשניות
            if (signedUrlData) {
              medicalDocumentUrls.push(signedUrlData.signedUrl);
            }
          }
        }
      }

      // 4. עדכון הסטודנט עם ה-URLs של הקבצים
      const updateData: {
        image_url?: string | null;
        cv_url?: string | null;
      } = {};

      if (imageUrl !== null) {
        updateData.image_url = imageUrl;
      }
      if (cvUrl !== null) {
        updateData.cv_url = cvUrl;
      }

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from("students")
          .update(updateData)
          .eq("id", studentId);

        if (updateError) {
          console.error("Error updating student with file URLs:", updateError);
          alert(
            "הקו״ח נוצר בהצלחה, אבל הייתה בעיה בעדכון כתובות הקבצים. אנא עדכן ידנית.",
          );
        }
      }

      // עדכון medical_records אם יש מסמכים
      // הערה: medical_records נוצר כבר בפונקציה המאוחסנת, אז רק צריך לעדכן אותו
      if (values.medical?.status && values.medical.status !== "good") {
        // בדיקה אם יש medical_records
        const { data: existingMedical, error: checkError } = await supabase
          .from("medical_records")
          .select("id")
          .eq("student_id", studentId)
          .single();

        if (checkError && checkError.code !== "PGRST116") {
          // PGRST116 = no rows returned, זה בסדר אם medical_records לא נוצר
          console.error("Error checking medical records:", checkError);
        }

        if (existingMedical || !checkError || checkError.code === "PGRST116") {
          // עדכון medical_records עם המסמכים
          const updateData: { documents: string[] } = {
            documents:
              medicalDocumentUrls.length > 0 ? medicalDocumentUrls : [],
          };

          const { data: updateDataResult, error: medicalUpdateError } =
            await supabase
              .from("medical_records")
              .update(updateData)
              .eq("student_id", studentId)
              .select();

          if (medicalUpdateError) {
            console.error(
              "Error updating medical records with documents:",
              medicalUpdateError,
            );
            console.error("Update data:", updateData);
            console.error("Student ID:", studentId);
            alert(
              `הקו״ח נשמר, אבל הייתה בעיה בעדכון מסמכים רפואיים: ${medicalUpdateError.message}`,
            );
          } else {
            console.log(
              "Medical records updated successfully:",
              updateDataResult,
            );
            console.log("Documents URLs:", medicalDocumentUrls);
          }
        } else {
          console.warn(
            "Medical records not found for student, cannot update documents",
          );
        }
      }

      console.log("Student created and files uploaded successfully");

      if (hasUploadErrors) {
        alert(
          "הקו״ח נשמר בהצלחה, אבל היו בעיות בהעלאת חלק מהקבצים. ניתן לעדכן את הקבצים מאוחר יותר.",
        );
      } else {
        alert("הקו״ח נשמר בהצלחה!");
      }

      // אפשר להוסיף כאן ניתוב לדף אחר או איפוס הטופס
      // router.push('/students')
    } catch (error) {
      console.error("Unexpected error:", error);
      alert("אירעה שגיאה לא צפויה");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentStep) {
    return null;
  }

  return (
    <Section asChild className="my-10 space-y-4">
      <div>
        <h1 className="mb-4 text-3xl font-bold">הוספת קו״ח למערכת</h1>
        <Box className="p-8">
          <div className="grid gap-8 md:grid-cols-[220px_minmax(0,1fr)]">
            <StepSidebar
              steps={steps}
              currentStepIndex={currentStepIndex}
              onStepClick={handleStepClick}
              gender={gender}
            />
            <div>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-8"
                >
                  <div className="space-y-6">
                    <h2 className="text-2xl font-semibold">
                      {getStepTitle(currentStep, gender)}
                    </h2>
                    {currentStep.sections.map((section) => (
                      <SectionRenderer
                        key={section.name}
                        section={section}
                        form={form}
                        values={formValues}
                        gender={gender}
                      />
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t pt-6">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={handlePreviousStep}
                      disabled={currentStepIndex === 0}
                      className="flex items-center gap-2"
                    >
                      <ArrowLeft className="size-4 rtl:rotate-180" />
                      <span>חזרה</span>
                    </Button>

                    {isLastStep ? (
                      <Button
                        type="submit"
                        className="flex items-center gap-2"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <span>שומר...</span>
                          </>
                        ) : (
                          <span>שליחה למערכת</span>
                        )}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={handleNextStep}
                        className="flex items-center gap-2"
                      >
                        <span>המשך לשלב הבא</span>
                        <ArrowRight className="size-4 rtl:rotate-180" />
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
            </div>
          </div>
        </Box>
      </div>
    </Section>
  );
}

type SectionRendererProps = {
  section: Step["sections"][number];
  form: ReturnType<typeof useForm<FormValues>>;
  values: FormValues;
  gender: "male" | "female" | "";
};

function SectionRenderer({
  section,
  form,
  values,
  gender,
}: SectionRendererProps) {
  const { control } = form;

  if (!section.fields.length || !shouldDisplaySection(section, values)) {
    return null;
  }

  return (
    <div className="space-y-4">
      {section.title && (
        <h3 className="text-lg font-semibold">{section.title}</h3>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {section.fields.map((field, index) => (
          <DynamicField
            key={`${field.name}-${index}`}
            field={field as any}
            control={control}
            values={values}
            gender={gender}
            getLabel={getFieldLabel}
          />
        ))}
      </div>
    </div>
  );
}

type StepSidebarProps = {
  steps: typeof studentFields;
  currentStepIndex: number;
  onStepClick: (index: number) => void;
  gender: "male" | "female" | "";
};

function shouldDisplaySection(
  section: Step["sections"][number],
  values: FormValues,
) {
  if (!section.condition || section.condition.length === 0) {
    return true;
  }

  return section.condition.every((condition) => {
    const compareValue = getValueByPath(values, condition.parameter);
    switch (condition.operator) {
      case "===":
        return compareValue === condition.value;
      case "!==":
        return compareValue !== condition.value;
      case "includes":
        return Array.isArray(compareValue)
          ? compareValue.includes(condition.value as never)
          : typeof compareValue === "string" &&
              compareValue.includes(String(condition.value));
      default:
        return true;
    }
  });
}

function StepSidebar({
  steps,
  currentStepIndex,
  onStepClick,
  gender,
}: StepSidebarProps) {
  const disableForwardNavigation =
    steps[currentStepIndex]?.name === "intro" && !gender;

  return (
    <nav className="space-y-2">
      {steps.map((step, index) => {
        const isActive = index === currentStepIndex;
        const isDisabled = disableForwardNavigation && index > currentStepIndex;
        return (
          <button
            key={step.name}
            type="button"
            onClick={() => onStepClick(index)}
            className={cn(
              "relative w-full rounded-lg px-3 py-2 text-right transition",
              isActive
                ? "bg-primary/10 text-primary before:bg-primary before:absolute before:top-1/2 before:right-0 before:h-1/2 before:w-1 before:-translate-y-1/2 before:rounded-l-2xl"
                : "hover:bg-muted/70 bg-transparent",
              isDisabled && "cursor-not-allowed opacity-60",
            )}
            disabled={isDisabled}
          >
            {getStepTitle(step, gender)}
          </button>
        );
      })}
    </nav>
  );
}

function getFieldLabel(
  field: Record<string, any>,
  gender: "male" | "female" | "",
) {
  const baseName = normalizePath((field.originalName ?? field.name) as string);
  if (gender !== "male" && gender !== "female") {
    return field.label;
  }
  const override = genderLabelOverrides[baseName];
  if (!override) {
    return field.label;
  }
  return override[gender] ?? field.label;
}

function getStepTitle(step: Step, gender: "male" | "female" | "") {
  if (gender && genderedStepTitles[step.name]) {
    return genderedStepTitles[step.name][gender];
  }
  return step.title;
}

function normalizePath(path: string) {
  return path.replace(/\[\d+\]/g, "");
}

function getValueByPath(source: Record<string, any>, path: unknown) {
  if (typeof path !== "string") return undefined;
  if (!path) return undefined;
  const segments = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);

  return segments.reduce<any>((acc, segment) => {
    if (acc == null) return undefined;
    return acc[segment];
  }, source);
}
