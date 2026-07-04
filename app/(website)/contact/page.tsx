"use client";
import Section from "@/components/layout/section";
import Box from "@/components/layout/box";
import { Button } from "@/components/ui/button";
import { useState } from "react";

function Field({
  label,
  required,
  type = "text",
  placeholder,
}: {
  label: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">
        {required && <span className="text-destructive">*</span>}
        {label}
      </label>
      {type === "textarea" ? (
        <textarea
          className="min-h-[100px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder={placeholder}
        />
      ) : (
        <input
          type={type}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

export default function ContactPage() {
  const [contactSent, setContactSent] = useState(false);
  const [engagementSent, setEngagementSent] = useState(false);
  const [ideaSent, setIdeaSent] = useState(false);

  return (
    <div className="flex flex-col">
      {/* Contact */}
      <Section containerClassName="py-16 md:py-24">
        <div className="mx-auto max-w-2xl space-y-8">
          <div className="space-y-2 text-center">
            <h1>צרו קשר</h1>
            <p className="text-muted-foreground">
              לכל שאלה ובקשה בנושא המערכת ובתחום השידוכים — אנחנו כאן בשבילכם!
            </p>
            <p className="text-sm font-medium">
              במייל:{" "}
              <a href="mailto:0000000@km.com" className="text-primary hover:underline">
                0000000@km.com
              </a>
            </p>
          </div>

          <Box className="flex flex-col gap-4 p-6">
            <p className="font-semibold">ניתן גם להשאיר פנייה ונחזור אליכם:</p>
            {contactSent ? (
              <p className="text-center text-green-600">הפנייה נשלחה בהצלחה! נחזור אליכם בקרוב.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="שם" required />
                  <Field label="מייל" required type="email" />
                  <Field label="טלפון" type="tel" />
                  <Field label="נושא" required />
                </div>
                <Field label="מה תרצו לומר לנו?" type="textarea" />
                <Button onClick={() => setContactSent(true)} className="w-full sm:w-auto sm:self-start">
                  שליחה
                </Button>
              </>
            )}
          </Box>
        </div>
      </Section>

      {/* Engagement announcement */}
      <Section id="engagement" className="bg-muted/40" containerClassName="py-16 md:py-24">
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="space-y-2 text-center">
            <h2>עדכון מאורסים</h2>
            <p className="text-muted-foreground">מגיע מזל טוב? עדכנו את כולם!</p>
          </div>

          <Box className="flex flex-col gap-6 p-6">
            {engagementSent ? (
              <p className="text-center text-green-600">
                המודעה התקבלה! תפורסם לאחר בדיקה.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {/* Groom */}
                  <div className="space-y-3">
                    <p className="font-bold text-primary">החתן</p>
                    <Field label="שם החתן" required />
                    <Field label="שם אביו" required />
                    <Field label="עיר" required />
                    <Field label="מישיבת" required />
                  </div>
                  {/* Bride */}
                  <div className="space-y-3">
                    <p className="font-bold text-primary">הכלה</p>
                    <Field label="שם הכלה" required />
                    <Field label="שם אביה" required />
                    <Field label="עיר" required />
                    <Field label="מסמינר" />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="תאריך ושעת סגירת השידוך" required type="datetime-local" />
                  <Field label="שם השדכן" />
                  <Field label="שם השולח" required />
                  <Field label="טלפון השולח" required type="tel" />
                  <Field label="מייל השולח" required type="email" />
                </div>
                <div className="flex flex-col gap-2">
                  <Button onClick={() => setEngagementSent(true)} className="w-full sm:w-auto sm:self-start">
                    שליחה
                  </Button>
                  <p className="text-xs text-muted-foreground">המודעה תפורסם באתר לאחר בדיקה</p>
                </div>
              </>
            )}
          </Box>
        </div>
      </Section>

      {/* Shidduch idea */}
      <Section containerClassName="py-16 md:py-24">
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="space-y-2 text-center">
            <h2>יש לכם רעיון לשידוך? תבורכו!</h2>
            <p className="text-muted-foreground">
              ניתן למלא את פרטי ההצעה כאן בטופס. המערכת תבחן את ההצעה ובמידה והיא תמצא מתאימה
              היא תוצע לצדדים ע"י שדכני קול מצהלות ואולי תקחו חלק בהקמת בית נאמן בישראל!
            </p>
          </div>

          <Box className="flex flex-col gap-6 p-6">
            {ideaSent ? (
              <p className="text-center text-green-600">
                ההצעה התקבלה! תשובה תישלח למייל שציינת.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {/* Male */}
                  <div className="space-y-3">
                    <p className="font-bold text-primary">המיועד</p>
                    <Field label="שם המיועד" required />
                    <Field label="שם אביו" required />
                    <Field label="עיר" required />
                    <Field label="מישיבת" required />
                    <Field label="גיל" required type="number" />
                    <Field label="סטטוס (רווק / גרוש / אלמן)" required />
                    <Field label="הקשר שלך למיועד" />
                  </div>
                  {/* Female */}
                  <div className="space-y-3">
                    <p className="font-bold text-primary">המיועדת</p>
                    <Field label="שם המיועדת" required />
                    <Field label="שם אביה" required />
                    <Field label="עיר" required />
                    <Field label="מסמינר" />
                    <Field label="גיל" required type="number" />
                    <Field label="סטטוס (רווקה / גרושה / אלמנה)" required />
                    <Field label="הקשר שלך למיועדת" />
                  </div>
                </div>
                <Field label="סיבת ההתאמה לדעתך" type="textarea" />
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">רוצה ללוות את השדכנים בקידום ההצעה?</span>
                    <label className="flex cursor-pointer items-center gap-1 text-sm">
                      <input type="radio" name="accompany" value="yes" className="accent-primary" />
                      כן
                    </label>
                    <label className="flex cursor-pointer items-center gap-1 text-sm">
                      <input type="radio" name="accompany" value="no" className="accent-primary" />
                      לא
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label="שמך" required />
                  <Field label="טלפון" required type="tel" />
                  <Field label="מייל" required type="email" />
                </div>
                <div className="flex flex-col gap-2">
                  <Button onClick={() => setIdeaSent(true)} className="w-full sm:w-auto sm:self-start">
                    שליחת הרעיון לשידוך
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    ההצעה תיבדק על ידי המערכת ותשובה תישלח למייל שציינת.
                  </p>
                </div>
              </>
            )}
          </Box>
        </div>
      </Section>
    </div>
  );
}
