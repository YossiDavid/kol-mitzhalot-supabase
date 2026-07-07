"use client";
import { useState } from "react";

const INPUT =
  "w-full border border-[#d7dcdd] rounded-[8px] px-3 py-[9px] text-[14px] text-[#212927] outline-none transition bg-white focus:border-[#2b5a5c] focus:shadow-[0_0_0_2px_rgba(43,90,92,.3)]";
const LABEL = "block text-[14px] font-semibold text-[#1b2523] mb-1.5";
const SUBMIT =
  "border-0 cursor-pointer bg-[#2b5a5c] text-[#f4f8f7] rounded-[8px] px-[26px] py-[11px] text-[15px] font-bold transition-colors hover:bg-[#234a4b]";

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
        {required && <span className="text-[#c0362c]">*</span>} {label}
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
        className="font-bold text-[#2b5a5c]"
        style={{ fontSize: "clamp(26px,3.2vw,38px)", marginBottom: 10, lineHeight: 1.15 }}
      >
        {children}
      </h2>
      {sub && <p className="text-[16.5px] text-[#5c6a68]">{sub}</p>}
    </div>
  );
}

function SuccessBox({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="rounded-[14px] border border-[#d9dee0] bg-white p-10 text-center">
      <p className="text-[18px] font-bold text-[#2b5a5c]">{title}</p>
      <p className="mt-2 text-[15px] text-[#5c6a68]">{sub}</p>
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
      <section className="bg-[#ecf0f2]">
        <div className="mx-auto px-6 py-[72px]" style={{ maxWidth: 1120 }}>
          <div className="mx-auto" style={{ maxWidth: 640 }}>
            <div className="mb-10 text-center">
              <h1
                className="font-bold text-[#2b5a5c]"
                style={{ fontSize: "clamp(30px,3.8vw,46px)", marginBottom: 12, lineHeight: 1.1 }}
              >
                צרו קשר
              </h1>
              <p className="text-[17px] text-[#5c6a68]">
                לכל שאלה ובקשה בנושא המערכת ובתחום השידוכים — אנחנו כאן בשבילכם!
              </p>
            </div>

            {contactSent ? (
              <SuccessBox title="הפנייה נשלחה בהצלחה!" sub="נחזור אליכם בקרוב." />
            ) : (
              <form
                className="flex flex-col gap-5 rounded-[14px] border border-[#d9dee0] bg-white p-[32px]"
                onSubmit={(e) => { e.preventDefault(); console.log("contact submitted"); setContactSent(true); }}
              >
                <div className="grid grid-cols-2 gap-4">
                  <Field label="שם" required />
                  <Field label="מייל" required type="email" />
                  <Field label="טלפון" type="tel" />
                  <Field label="נושא" required />
                </div>
                <Field label="הודעה" required type="textarea" rows={5} />
                <div>
                  <button type="submit" className={SUBMIT}>שליחה</button>
                  <p className="mt-2 text-[12.5px] text-[#889492]">נחזור אליכם תוך 24 שעות בימי עסקים.</p>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Section 2 — Engagement announcement */}
      <section id="engagement" className="bg-[#e3e9eb]">
        <div className="mx-auto px-6 py-[72px]" style={{ maxWidth: 1120 }}>
          <div className="mx-auto" style={{ maxWidth: 760 }}>
            <SectionHeading sub="מגיע מזל טוב? עדכנו את כולם!">פרסום מודעת מאורסים</SectionHeading>

            {engagementSent ? (
              <SuccessBox title="המודעה התקבלה!" sub="תפורסם לאחר בדיקה ואישור." />
            ) : (
              <form
                className="flex flex-col gap-6 rounded-[14px] border border-[#d9dee0] bg-white p-[32px]"
                onSubmit={(e) => { e.preventDefault(); console.log("engagement submitted"); setEngagementSent(true); }}
              >
                <div className="grid grid-cols-2 gap-8">
                  <div className="flex flex-col gap-4">
                    <p className="font-bold text-[#2b5a5c]" style={{ fontSize: 16 }}>החתן</p>
                    <Field label="שם החתן" required />
                    <Field label="שם אביו" required />
                    <Field label="עיר" required />
                    <Field label="מישיבת" />
                  </div>
                  <div className="flex flex-col gap-4">
                    <p className="font-bold text-[#2b5a5c]" style={{ fontSize: 16 }}>הכלה</p>
                    <Field label="שם הכלה" required />
                    <Field label="שם אביה" required />
                    <Field label="עיר" required />
                    <Field label="סמינר" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="תאריך ושעת סגירת השידוך" required type="datetime-local" />
                  <Field label="שם השדכן" />
                  <Field label="שם השולח" required />
                  <Field label="טלפון השולח" required type="tel" />
                  <Field label="מייל השולח" required type="email" />
                </div>
                <div>
                  <button type="submit" className={SUBMIT}>שליחה</button>
                  <p className="mt-2 text-[12.5px] text-[#889492]">המודעה תפורסם באתר לאחר בדיקה ואישור.</p>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Section 3 — Shidduch idea */}
      <section className="bg-[#ecf0f2]">
        <div className="mx-auto px-6 py-[72px]" style={{ maxWidth: 1120 }}>
          <div className="mx-auto" style={{ maxWidth: 760 }}>
            <SectionHeading sub='ניתן למלא את פרטי ההצעה כאן בטופס. המערכת תבחן את ההצעה ובמידה והיא תמצא מתאימה היא תוצע לצדדים ע"י שדכני קול מצהלות!'>
              יש לכם רעיון לשידוך? תבורכו!
            </SectionHeading>

            {ideaSent ? (
              <SuccessBox title="ההצעה התקבלה!" sub="תשובה תישלח למייל שציינת." />
            ) : (
              <form
                className="flex flex-col gap-6 rounded-[14px] border border-[#d9dee0] bg-white p-[32px]"
                onSubmit={(e) => { e.preventDefault(); console.log("idea submitted"); setIdeaSent(true); }}
              >
                <div className="grid grid-cols-2 gap-8">
                  <div className="flex flex-col gap-4">
                    <p className="font-bold text-[#2b5a5c]" style={{ fontSize: 16 }}>המיועד</p>
                    <Field label="שם המיועד" required />
                    <Field label="שם אביו" required />
                    <Field label="עיר" required />
                    <Field label="מישיבת" />
                    <Field label="גיל" required type="number" />
                    <Field label="סטטוס" required placeholder="רווק / גרוש / אלמן" />
                  </div>
                  <div className="flex flex-col gap-4">
                    <p className="font-bold text-[#2b5a5c]" style={{ fontSize: 16 }}>המיועדת</p>
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
                    <label className="flex cursor-pointer items-center gap-2 text-[14px]">
                      <input type="radio" name="accompany" value="yes" className="accent-[#2b5a5c]" />
                      כן
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-[14px]">
                      <input type="radio" name="accompany" value="no" className="accent-[#2b5a5c]" />
                      לא
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="שמך" required />
                  <Field label="טלפון" required type="tel" />
                  <Field label="מייל" required type="email" />
                </div>
                <div>
                  <button type="submit" className={SUBMIT}>שליחת הרעיון לשידוך</button>
                  <p className="mt-2 text-[12.5px] text-[#889492]">ההצעה תיבדק על ידי המערכת ותשובה תישלח למייל שציינת.</p>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
