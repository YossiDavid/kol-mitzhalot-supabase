"use client";
import { useState } from "react";

const INPUT =
  "w-full border border-border rounded-[8px] px-3 py-[9px] text-body-sm text-foreground outline-none transition bg-card focus:border-primary focus:ring-primary-focus";
const LABEL = "block text-body-sm font-semibold text-foreground mb-1.5";
const SUBMIT =
  "border-0 cursor-pointer bg-primary text-primary-foreground rounded-[8px] px-[26px] py-[11px] text-body font-bold transition-colors hover:bg-primary-active";

function Field({
  label,
  required,
  type = "text",
  placeholder,
  rows,
}: {
  label: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className={LABEL}>
        {required && <span className="text-destructive">*</span>} {label}
      </label>
      {type === "textarea" ? (
        <textarea
          className={INPUT}
          placeholder={placeholder}
          rows={rows ?? 5}
          style={{ resize: "vertical", minHeight: 100 }}
        />
      ) : (
        <input type={type} className={INPUT} placeholder={placeholder} />
      )}
    </div>
  );
}

function SectionHeading({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-10 text-center">
      <h2
        className="font-bold text-primary text-display" style={{marginBottom: 10, lineHeight: 1.15}}
      >
        {children}
      </h2>
      {sub && <p className="text-body text-muted-foreground">{sub}</p>}
    </div>
  );
}

function SuccessBox({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="rounded-[14px] border border-border bg-card p-10 text-center">
      <p className="text-subtitle font-bold text-primary">{title}</p>
      <p className="mt-2 text-body text-muted-foreground">{sub}</p>
    </div>
  );
}

export default function ContactPage() {
  const [contactSent, setContactSent] = useState(false);
  const [engagementSent, setEngagementSent] = useState(false);
  const [ideaSent, setIdeaSent] = useState(false);

  return (
    <>
      {/* Section 1 — General contact */}
      <section className="bg-background">
        <div className="mx-auto px-6 py-[72px]" style={{ maxWidth: 1120 }}>
          <div className="mx-auto" style={{ maxWidth: 640 }}>
            <div className="mb-10 text-center">
              <h1
                className="font-bold text-primary text-display" style={{marginBottom: 12, lineHeight: 1.1}}
              >
                צרו קשר
              </h1>
              <p className="text-subtitle text-muted-foreground">
                לכל שאלה ובקשה בנושא המערכת ובתחום השידוכים — אנחנו כאן בשבילכם!
              </p>
            </div>

            {contactSent ? (
              <SuccessBox title="הפנייה נשלחה בהצלחה!" sub="נחזור אליכם בקרוב." />
            ) : (
              <form
                className="flex flex-col gap-5 rounded-[14px] border border-border bg-card p-[32px]"
                onSubmit={(e) => { e.preventDefault(); console.log("contact submitted"); setContactSent(true); }}
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="שם" required />
                  <Field label="מייל" required type="email" />
                  <Field label="טלפון" type="tel" />
                  <Field label="נושא" required />
                </div>
                <Field label="הודעה" required type="textarea" rows={5} />
                <div>
                  <button type="submit" className={SUBMIT}>שליחה</button>
                  <p className="mt-2 text-caption text-muted-foreground">נחזור אליכם תוך 24 שעות בימי עסקים.</p>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Section 2 — Engagement announcement */}
      <section id="engagement" className="bg-muted">
        <div className="mx-auto px-6 py-[72px]" style={{ maxWidth: 1120 }}>
          <div className="mx-auto" style={{ maxWidth: 760 }}>
            <SectionHeading sub="מגיע מזל טוב? עדכנו את כולם!">פרסום מודעת מאורסים</SectionHeading>

            {engagementSent ? (
              <SuccessBox title="המודעה התקבלה!" sub="תפורסם לאחר בדיקה ואישור." />
            ) : (
              <form
                className="flex flex-col gap-6 rounded-[14px] border border-border bg-card p-[32px]"
                onSubmit={(e) => { e.preventDefault(); console.log("engagement submitted"); setEngagementSent(true); }}
              >
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                  <div className="flex flex-col gap-4">
                    <p className="font-bold text-primary text-body">החתן</p>
                    <Field label="שם החתן" required />
                    <Field label="שם אביו" required />
                    <Field label="עיר" required />
                    <Field label="מישיבת" />
                  </div>
                  <div className="flex flex-col gap-4">
                    <p className="font-bold text-primary text-body">הכלה</p>
                    <Field label="שם הכלה" required />
                    <Field label="שם אביה" required />
                    <Field label="עיר" required />
                    <Field label="סמינר" />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="תאריך ושעת סגירת השידוך" required type="datetime-local" />
                  <Field label="שם השדכן" />
                  <Field label="שם השולח" required />
                  <Field label="טלפון השולח" required type="tel" />
                  <Field label="מייל השולח" required type="email" />
                </div>
                <div>
                  <button type="submit" className={SUBMIT}>שליחה</button>
                  <p className="mt-2 text-caption text-muted-foreground">המודעה תפורסם באתר לאחר בדיקה ואישור.</p>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Section 3 — Shidduch idea */}
      <section className="bg-background">
        <div className="mx-auto px-6 py-[72px]" style={{ maxWidth: 1120 }}>
          <div className="mx-auto" style={{ maxWidth: 760 }}>
            <SectionHeading sub='ניתן למלא את פרטי ההצעה כאן בטופס. המערכת תבחן את ההצעה ובמידה והיא תמצא מתאימה היא תוצע לצדדים ע"י שדכני קול מצהלות!'>
              יש לכם רעיון לשידוך? תבורכו!
            </SectionHeading>

            {ideaSent ? (
              <SuccessBox title="ההצעה התקבלה!" sub="תשובה תישלח למייל שציינת." />
            ) : (
              <form
                className="flex flex-col gap-6 rounded-[14px] border border-border bg-card p-[32px]"
                onSubmit={(e) => { e.preventDefault(); console.log("idea submitted"); setIdeaSent(true); }}
              >
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                  <div className="flex flex-col gap-4">
                    <p className="font-bold text-primary text-body">המיועד</p>
                    <Field label="שם המיועד" required />
                    <Field label="שם אביו" required />
                    <Field label="עיר" required />
                    <Field label="מישיבת" />
                    <Field label="גיל" required type="number" />
                    <Field label="סטטוס" required placeholder="רווק / גרוש / אלמן" />
                  </div>
                  <div className="flex flex-col gap-4">
                    <p className="font-bold text-primary text-body">המיועדת</p>
                    <Field label="שם המיועדת" required />
                    <Field label="שם אביה" required />
                    <Field label="עיר" required />
                    <Field label="סמינר" />
                    <Field label="גיל" required type="number" />
                    <Field label="סטטוס" required placeholder="רווקה / גרושה / אלמנה" />
                  </div>
                </div>
                <Field label="סיבת ההתאמה לדעתך" type="textarea" rows={4} />
                <div>
                  <p className={LABEL}>רוצה ללוות את השדכנים בקידום ההצעה?</p>
                  <div className="flex gap-6">
                    <label className="flex cursor-pointer items-center gap-2 text-body-sm">
                      <input type="radio" name="accompany" value="yes" className="accent-primary" />
                      כן
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-body-sm">
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
                <div>
                  <button type="submit" className={SUBMIT}>שליחת הרעיון לשידוך</button>
                  <p className="mt-2 text-caption text-muted-foreground">ההצעה תיבדק על ידי המערכת ותשובה תישלח למייל שציינת.</p>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
