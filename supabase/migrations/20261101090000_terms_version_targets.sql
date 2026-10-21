-- תקנון מעודכן לקבוצות משתמשים: המנהל יכול לפרסם גרסה חדשה של התקנון לכולם
-- או רק לקבוצות מסוימות (שדכנים / צוות / משתמשים רגילים). מי שבקבוצת היעד
-- חייב לאשר את הגרסה לפני המשך פעילות; השאר אינם נחסמים.
--
--  * terms_versions: לכל גרסה שפורסמה - קבוצות היעד (NULL = כולם).
--    גרסה בלי שורה (כמו גרסה 1 שלפני המיגרציה) נחשבת "לכולם".
--  * publish_system_content_version(p_key, p_target_groups): פרמטר שני
--    אופציונלי. קריאה ישנה עם p_key בלבד ממשיכה לעבוד (= לכולם).
--  * get_terms_gate_status: הגרסה הנדרשת = הגרסה הגבוהה ביותר שמיועדת
--    למשתמש. האישור עצמו נרשם תמיד לגרסה הנוכחית (RLS ללא שינוי) - והוא
--    מכסה את כל הגרסאות שלפניה.
--
-- קבוצות: 'shadchan', 'staff' (לפי app_metadata.roles), 'user' = משתמש רגיל
-- (אין לו admin/shadchan/staff).
--
-- אידמפוטנטית. להחלה: psql -v ON_ERROR_STOP=1 -f <file>

-- ── 1. קבוצות היעד לכל גרסה ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.terms_versions (
  version       integer PRIMARY KEY CHECK (version >= 1),
  target_groups text[] CHECK (
    target_groups IS NULL
    OR (cardinality(target_groups) > 0
        AND target_groups <@ ARRAY['shadchan', 'staff', 'user']::text[])
  ),
  published_at  timestamptz NOT NULL DEFAULT now(),
  published_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.terms_versions IS
  'גרסאות התקנון שפורסמו וקבוצות היעד שלהן. target_groups NULL = כל המשתמשים.';

ALTER TABLE public.terms_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "terms_versions_select_admin" ON public.terms_versions;
CREATE POLICY "terms_versions_select_admin" ON public.terms_versions
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

REVOKE ALL ON TABLE public.terms_versions FROM anon;
REVOKE ALL ON TABLE public.terms_versions FROM authenticated;
GRANT SELECT ON TABLE public.terms_versions TO authenticated;
GRANT ALL ON TABLE public.terms_versions TO service_role;

-- ── 2. האם גרסה מיועדת למשתמש ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.terms_group_matches(p_uid uuid, p_groups text[])
RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT p_groups IS NULL
    OR ('shadchan' = ANY (p_groups) AND public.has_role(p_uid, 'shadchan'))
    OR ('staff' = ANY (p_groups) AND public.has_role(p_uid, 'staff'))
    OR ('user' = ANY (p_groups)
        AND NOT public.has_role(p_uid, 'admin')
        AND NOT public.has_role(p_uid, 'shadchan')
        AND NOT public.has_role(p_uid, 'staff'));
$$;

ALTER FUNCTION public.terms_group_matches(uuid, text[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.terms_group_matches(uuid, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.terms_group_matches(uuid, text[]) FROM anon;
REVOKE ALL ON FUNCTION public.terms_group_matches(uuid, text[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.terms_group_matches(uuid, text[]) TO service_role;

-- ── 3. פרסום גרסה עם קבוצות יעד ──────────────────────────────────
DROP FUNCTION IF EXISTS public.publish_system_content_version(text);

CREATE OR REPLACE FUNCTION public.publish_system_content_version(
  p_key text,
  p_target_groups text[] DEFAULT NULL
)
RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_version integer;
  v_groups text[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- מערך ריק = לכולם
  v_groups := CASE WHEN cardinality(p_target_groups) > 0 THEN p_target_groups END;
  IF v_groups IS NOT NULL
     AND NOT (v_groups <@ ARRAY['shadchan', 'staff', 'user']::text[]) THEN
    RAISE EXCEPTION 'invalid_target_groups' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.publishing_content_version', 'on', true);

  UPDATE public.system_content
  SET version = version + 1
  WHERE key = p_key
  RETURNING version INTO v_version;

  PERFORM set_config('app.publishing_content_version', '', true);

  IF v_version IS NULL THEN
    RAISE EXCEPTION 'content_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_key = 'terms-of-service' THEN
    INSERT INTO public.terms_versions (version, target_groups, published_by)
    VALUES (v_version, v_groups, auth.uid())
    ON CONFLICT (version) DO UPDATE
      SET target_groups = EXCLUDED.target_groups,
          published_at = now(),
          published_by = EXCLUDED.published_by;
  END IF;

  RETURN v_version;
END;
$$;

ALTER FUNCTION public.publish_system_content_version(text, text[]) OWNER TO postgres;

COMMENT ON FUNCTION public.publish_system_content_version(text, text[])
  IS 'מנהל בלבד: מעלה את גרסת התוכן ב-1. לתקנון - מחייב את קבוצות היעד (NULL/ריק = כולם) לאשר מחדש.';

REVOKE ALL ON FUNCTION public.publish_system_content_version(text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_system_content_version(text, text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.publish_system_content_version(text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_system_content_version(text, text[]) TO service_role;

-- ── 4. מצב החסימה: הגרסה הגבוהה ביותר שמיועדת למשתמש ─────────────
CREATE OR REPLACE FUNCTION public.get_terms_gate_status()
RETURNS TABLE (required_version integer, accepted_version integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  WITH cur AS (
    SELECT COALESCE((SELECT sc.version FROM public.system_content sc
                     WHERE sc.key = 'terms-of-service'), 0) AS v
  ),
  -- הגרסאות 1..נוכחית; גרסה בלי שורה ב-terms_versions = לכולם
  applicable AS (
    SELECT max(g.v) AS v
    FROM cur
    CROSS JOIN LATERAL generate_series(1, cur.v) AS g(v)
    LEFT JOIN public.terms_versions tv ON tv.version = g.v
    WHERE tv.version IS NULL
       OR public.terms_group_matches(auth.uid(), tv.target_groups)
  )
  SELECT
    CASE
      WHEN (SELECT s.value FROM public.system_settings s
            WHERE s.key = 'terms_gate_enabled') IS FALSE THEN 0
      ELSE COALESCE((SELECT a.v FROM applicable a), 0)
    END,
    COALESCE((SELECT max(ta.version) FROM public.terms_acceptances ta
              WHERE ta.user_id = auth.uid()), 0)
  WHERE auth.uid() IS NOT NULL;
$$;

ALTER FUNCTION public.get_terms_gate_status() OWNER TO postgres;

COMMENT ON FUNCTION public.get_terms_gate_status()
  IS 'למעטפת /app: גרסת התקנון הגבוהה ביותר שמיועדת למשתמש (0 = אין חסימה) והגרסה האחרונה שאישר.';

REVOKE ALL ON FUNCTION public.get_terms_gate_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_terms_gate_status() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_terms_gate_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_terms_gate_status() TO service_role;

-- ── 5. אישור גרסה שאינה הנוכחית ──────────────────────────────────
-- משתמש שהגרסה הנוכחית לא מיועדת לו נחסם על גרסה קודמת (הגבוהה ביותר
-- שמיועדת לו), והדיאלוג שולח אותה. המדיניות הישנה התירה רק את הגרסה
-- הנוכחית - והאישור היה נדחה תמיד. מותרת כל גרסה שכבר פורסמה (עדיין אי
-- אפשר "לאשר מראש" גרסה עתידית); אישור ישן לא פותח חסימה של גרסה חדשה יותר.
DROP POLICY IF EXISTS "terms_acceptances_insert_own_current" ON public.terms_acceptances;
CREATE POLICY "terms_acceptances_insert_own_current" ON public.terms_acceptances
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND version <= (
      SELECT sc.version FROM public.system_content sc
      WHERE sc.key = 'terms-of-service'
    )
  );

-- ── Rollback (להריץ ידנית) ──
-- להחזיר את get_terms_gate_status ו-publish_system_content_version(text)
-- מ-20261029090000_terms_acceptance.sql, ואז:
-- DROP FUNCTION IF EXISTS public.publish_system_content_version(text, text[]);
-- DROP FUNCTION IF EXISTS public.terms_group_matches(uuid, text[]);
-- DROP TABLE IF EXISTS public.terms_versions;
