"use client";

/**
 * Callers: /contact route. Uses public-forms server actions.
 * Schema: contact_submissions, engagements.
 * User: "3. לחבר את הטפסים למערכת הניהול ולDB."
 */

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  submitContactForm,
  submitEngagementForm,
  submitShidduchIdeaForm,
  type FormActionResult,
} from "@/app/(website)/actions/public-forms";

function Field({
  label,
  name,
  required,
  type = "text",
  placeholder,
  rows,
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name} required={required}>
        {label}
      </Label>
      {type === "textarea" ? (
        <Textarea
          id={name}
          name={name}
          required={required}
          placeholder={placeholder}
          rows={rows ?? 5}
        />
      ) : (
        <Input
          id={name}
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

function SectionHeading({
  children,
  sub,
}: {
  children: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="mb-10 text-center">
      <h2 className="mb-2.5 text-display font-bold text-primary">{children}</h2>
      {sub ? <p className="text-body text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function SuccessBox({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-10 text-center">
      <p className="text-subtitle font-bold text-primary">{title}</p>
      <p className="mt-2 text-body text-muted-foreground">{sub}</p>
    </div>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="border-b border-border pb-2 text-body font-bold text-primary">
        {title}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function FormError({ state }: { state: FormActionResult | null }) {
  if (!state || state.ok) return null;
  return (
    <p className="text-body-sm text-destructive" role="alert">
      {state.error}
    </p>
  );
}

const initial: FormActionResult | null = null;

function ContactForm() {
  const [state, action, pending] = useActionState(submitContactForm, initial);
  if (state?.ok) {
    return <SuccessBox title="הפנייה נשלחה בהצלחה!" sub="נחזור אליכם בקרוב." />;
  }
  return (
    <form action={action} className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="שם" name="name" required />
        <Field label="מייל" name="email" required type="email" />
        <Field label="טלפון" name="phone" type="tel" />
        <Field label="נושא" name="subject" required />
      </div>
      <Field label="הודעה" name="message" required type="textarea" rows={5} />
      <FormError state={state} />
      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "שולח..." : "שליחה"}
        </Button>
        <p className="mt-2 text-caption text-muted-foreground">
          נחזור אליכם תוך 24 שעות בימי עסקים.
        </p>
      </div>
    </form>
  );
}

function EngagementForm() {
  const [state, action, pending] = useActionState(submitEngagementForm, initial);
  if (state?.ok) {
    return (
      <SuccessBox title="המודעה התקבלה!" sub="תפורסם לאחר בדיקה ואישור." />
    );
  }
  return (
    <form action={action} className="flex flex-col gap-8 rounded-2xl border border-border bg-card p-8">
      <FormSection title="החתן">
        <Field label="שם החתן" name="groom_name" required />
        <Field label="שם אביו" name="groom_father" required />
        <Field label="עיר" name="groom_city" required />
        <Field label="מישיבת" name="groom_yeshiva" />
      </FormSection>
      <FormSection title="הכלה">
        <Field label="שם הכלה" name="bride_name" required />
        <Field label="שם אביה" name="bride_father" required />
        <Field label="עיר" name="bride_city" required />
        <Field label="סמינר" name="bride_seminary" />
      </FormSection>
      <FormSection title="פרטי השידוך והשולח">
        <Field
          label="תאריך ושעת סגירת השידוך"
          name="closed_at"
          required
          type="datetime-local"
        />
        <Field label="שם השדכן" name="shadchan_name" />
        <Field label="שם השולח" name="submitter_name" required />
        <Field label="טלפון השולח" name="submitter_phone" required type="tel" />
        <Field label="מייל השולח" name="submitter_email" required type="email" />
      </FormSection>
      <FormError state={state} />
      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "שולח..." : "שליחה"}
        </Button>
        <p className="mt-2 text-caption text-muted-foreground">
          המודעה תפורסם באתר לאחר בדיקה ואישור.
        </p>
      </div>
    </form>
  );
}

function IdeaForm() {
  const [state, action, pending] = useActionState(submitShidduchIdeaForm, initial);
  if (state?.ok) {
    return (
      <SuccessBox title="ההצעה התקבלה!" sub="תשובה תישלח למייל שציינת." />
    );
  }
  return (
    <form action={action} className="flex flex-col gap-8 rounded-2xl border border-border bg-card p-8">
      <FormSection title="המיועד">
        <Field label="שם המיועד" name="male_name" required />
        <Field label="שם אביו" name="male_father" required />
        <Field label="עיר" name="male_city" required />
        <Field label="מישיבת" name="male_yeshiva" />
        <Field label="גיל" name="male_age" required type="number" />
        <Field
          label="סטטוס"
          name="male_status"
          required
          placeholder="רווק / גרוש / אלמן"
        />
      </FormSection>
      <FormSection title="המיועדת">
        <Field label="שם המיועדת" name="female_name" required />
        <Field label="שם אביה" name="female_father" required />
        <Field label="עיר" name="female_city" required />
        <Field label="סמינר" name="female_seminary" />
        <Field label="גיל" name="female_age" required type="number" />
        <Field
          label="סטטוס"
          name="female_status"
          required
          placeholder="רווקה / גרושה / אלמנה"
        />
      </FormSection>
      <Field label="סיבת ההתאמה לדעתך" name="reason" type="textarea" rows={4} />
      <div>
        <p className="text-label mb-1.5 font-bold">
          רוצה ללוות את השדכנים בקידום ההצעה?
        </p>
        <div className="flex gap-6">
          <label className="flex cursor-pointer items-center gap-2 text-body-sm">
            <input
              type="radio"
              name="accompany"
              value="yes"
              className="accent-primary"
            />
            כן
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-body-sm">
            <input
              type="radio"
              name="accompany"
              value="no"
              defaultChecked
              className="accent-primary"
            />
            לא
          </label>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="שמך" name="submitter_name" required />
        <Field label="טלפון" name="submitter_phone" required type="tel" />
        <Field label="מייל" name="submitter_email" required type="email" />
      </div>
      <FormError state={state} />
      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "שולח..." : "שליחת הרעיון לשידוך"}
        </Button>
        <p className="mt-2 text-caption text-muted-foreground">
          ההצעה תיבדק על ידי המערכת ותשובה תישלח למייל שציינת.
        </p>
      </div>
    </form>
  );
}

export default function ContactPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="bg-brand-gold-wash pointer-events-none absolute inset-0" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo_negative.svg"
          alt=""
          aria-hidden="true"
          width={720}
          height={720}
          className="pointer-events-none absolute -top-28 -left-24 opacity-[0.07] select-none"
        />

        <div className="relative shell-site flex flex-col items-center justify-center py-24 text-center md:py-28">
          <h1 className="text-hero text-primary-foreground">צרו קשר</h1>
          <p className="mt-8 max-w-2xl text-subtitle text-primary-foreground/85">
            לכל שאלה ובקשה בנושא המערכת ובתחום השידוכים — אנחנו כאן בשבילכם!
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="bg-primary-foreground text-primary hover:bg-card hover:text-primary active:bg-card"
            >
              <a href="#contact">צרו קשר</a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/50 text-primary-foreground shadow-none hover:bg-primary-foreground/10 hover:text-primary-foreground active:bg-primary-foreground/15"
            >
              <a href="#engagement">פרסום מודעת מאורסים</a>
            </Button>
            <Button
              asChild
              size="lg"
              className="bg-brand-gold text-brand-gold-foreground hover:bg-brand-gold-soft active:bg-brand-gold-muted"
            >
              <a href="#idea">יש לכם רעיון לשידוך? תבורכו!</a>
            </Button>
          </div>
        </div>
      </section>

      <section id="contact" className="scroll-mt-20 bg-background">
        <div className="shell-site py-16 md:py-20">
          <div className="mx-auto w-full max-w-xl">
            <ContactForm />
          </div>
        </div>
      </section>

      <section id="engagement" className="scroll-mt-20 bg-secondary">
        <div className="shell-site py-16 md:py-20">
          <div className="mx-auto w-full max-w-3xl">
            <SectionHeading sub="מגיע מזל טוב? עדכנו את כולם!">
              פרסום מודעת מאורסים
            </SectionHeading>
            <EngagementForm />
          </div>
        </div>
      </section>

      <section id="idea" className="scroll-mt-20 bg-background">
        <div className="shell-site py-16 md:py-20">
          <div className="mx-auto w-full max-w-3xl">
            <SectionHeading sub='ניתן למלא את פרטי ההצעה כאן בטופס. המערכת תבחן את ההצעה ובמידה והיא תמצא מתאימה היא תוצע לצדדים ע"י שדכני קול מצהלות!'>
              יש לכם רעיון לשידוך? תבורכו!
            </SectionHeading>
            <IdeaForm />
          </div>
        </div>
      </section>
    </>
  );
}
