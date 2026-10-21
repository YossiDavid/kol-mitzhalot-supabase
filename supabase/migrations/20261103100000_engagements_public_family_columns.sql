-- מודעת מאורסים בעיצוב המסורתי: שם האב ("בהר"ר ..."), הישיבה והסמינר
-- מוצגים במודעה באתר. עד עכשיו העמודות האלה היו סגורות לקריאה ציבורית
-- (20261007090000_security_hardening.sql). ה-RLS (engagements_public_select)
-- ממשיך להחזיר לציבור רק מודעות מפורסמות - כלומר רק מה שמנהל אישר לפרסום.
-- פרטי השולח (submitter_*) ומזהי השידוך והכרטיסים נשארים סגורים.
--
-- אידמפוטנטית. להחלה: psql -v ON_ERROR_STOP=1 -f <file>

GRANT SELECT (groom_father, groom_yeshiva, bride_father, bride_seminary)
  ON TABLE public.engagements TO anon, authenticated;

-- ── Rollback (להריץ ידנית) ──
-- REVOKE SELECT (groom_father, groom_yeshiva, bride_father, bride_seminary)
--   ON TABLE public.engagements FROM anon, authenticated;
