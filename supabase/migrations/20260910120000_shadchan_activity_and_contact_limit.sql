-- "שדכנים שפעלו בשבילך" + מכסת פניות יומית של הורים לשדכנים.
--
-- רקע 1: אזור "שדכנים שפעלו בשבילך" בלוח הבקרה של ההורה קיבל רשימה ריקה
-- מקודדת, כי לא היה שום מקום שמרכז "איזה שדכן נגע בכרטיס של הילד שלי".
-- צפייה בכרטיס בכלל לא נרשמה. כאן נוספים:
--   • student_card_views - רישום צפייה של שדכן בכרטיס מיועד (שורה אחת
--     לזוג שדכן/כרטיס, עם מונה ותאריך צפייה אחרון).
--   • get_shadchanim_who_acted_for_me - מאחדת את כל מקורות הפעילות
--     (הצעות שידוך שיצאו, צפיות, בקשות צפייה בתמונה, פנייה בצ'אט)
--     ומחזירה את השדכנים עם פרטי הכרטיס הציבורי שלהם.
--
-- רקע 2: הלקוח ביקש להגביל כמה שדכנים הורה יכול לפנות אליהם ביום, כדי
-- לסנן מטרידים. "פנייה" = פתיחת שיחה עם שדכן. היא נאכפת כאן ב-DB ולא
-- בקוד השרת, כי הצ'אט נכתב מהדפדפן ישירות (get_or_create_dm_room) -
-- אכיפה ב-route הייתה ניתנת לעקיפה בקריאה ישירה ל-API של Supabase.
--   • המכסה נספרת לפי יום קלנדרי בשעון ישראל (Asia/Jerusalem): "היום"
--     מתאפס בחצות, וזה מה שההורה מבין כשכתוב לו "נותרו לך היום".
--   • נספרים שדכנים שונים. פנייה חוזרת לאותו שדכן באותו יום לא נספרת
--     שוב, והמשך התכתבות בשיחה קיימת לא נספר כלל.
--   • שדכנים ומנהלים פטורים.
--
-- אידמפוטנטית - ניתן להריץ שוב על סביבה שכבר הוחלה עליה בלי שגיאה.

-- ── קבועים ────────────────────────────────────────────────────────
-- system_settings מחזיקה רק ערכים בוליאניים (value boolean), ולכן המכסה
-- היא פונקציה ולא שורה שם. מקור אמת אחד: הממשק מקבל את המספר מ-
-- get_my_shadchan_contact_quota ולא מחזיק עותק משלו.
CREATE OR REPLACE FUNCTION public.shadchan_daily_contact_limit() RETURNS integer
    LANGUAGE sql IMMUTABLE
    AS $$ SELECT 5 $$;

ALTER FUNCTION public.shadchan_daily_contact_limit() OWNER TO postgres;

COMMENT ON FUNCTION public.shadchan_daily_contact_limit()
  IS 'כמה שדכנים שונים הורה רשאי לפנות אליהם ביום (יום קלנדרי בשעון ישראל)';

CREATE OR REPLACE FUNCTION public.israel_today() RETURNS date
    LANGUAGE sql STABLE
    AS $$ SELECT (now() AT TIME ZONE 'Asia/Jerusalem')::date $$;

ALTER FUNCTION public.israel_today() OWNER TO postgres;

COMMENT ON FUNCTION public.israel_today()
  IS 'התאריך של היום בשעון ישראל - גבול היום של מכסת הפניות';

-- מי מופיע ב"שדכנים שפעלו בשבילך" ולמי מותר לפנות דרך הטופס. גם מנהל:
-- מנהל יכול ליצור הצעת שידוך, ואז הוא מופיע ברשימה וההורה צריך להיות
-- מסוגל לפנות אליו.
CREATE OR REPLACE FUNCTION public.is_contactable_shadchan(uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT public.has_role(uid, 'shadchan') OR public.has_role(uid, 'admin');
$$;

ALTER FUNCTION public.is_contactable_shadchan(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.is_contactable_shadchan(uuid)
  IS 'שדכן או מנהל - מי שמוצג להורה כשדכן ומותר לפנות אליו';

-- ── 1. צפיות בכרטיס ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_card_views (
  student_id      uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  viewer_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_viewed_at timestamptz NOT NULL DEFAULT now(),
  last_viewed_at  timestamptz NOT NULL DEFAULT now(),
  view_count      integer NOT NULL DEFAULT 1 CHECK (view_count > 0),
  PRIMARY KEY (student_id, viewer_id)
);

COMMENT ON TABLE  public.student_card_views                 IS 'צפיות של שדכנים בכרטיסי מיועדים. שורה אחת לזוג שדכן/כרטיס. נכתבת רק דרך record_student_card_view';
COMMENT ON COLUMN public.student_card_views.viewer_id       IS 'השדכן שצפה';
COMMENT ON COLUMN public.student_card_views.last_viewed_at  IS 'הצפייה האחרונה - לפיה ממוינת רשימת "שדכנים שפעלו בשבילך"';
COMMENT ON COLUMN public.student_card_views.view_count      IS 'כמה פעמים נפתח הכרטיס (כולל רענונים)';

-- המפתח הראשי מתחיל ב-student_id ומשרת את שאילתת ההורה; זה משרת את
-- מחיקת ה-CASCADE כשמשתמש נמחק.
CREATE INDEX IF NOT EXISTS idx_student_card_views_viewer_id
  ON public.student_card_views (viewer_id);

ALTER TABLE public.student_card_views ENABLE ROW LEVEL SECURITY;

-- ההורה לא קורא את הטבלה ישירות אלא דרך get_shadchanim_who_acted_for_me,
-- שמחזירה רק את מה שהוא צריך. אין מדיניות כתיבה: כתיבה רק דרך ה-RPC.
DROP POLICY IF EXISTS "Student_card_views select own or admin" ON public.student_card_views;
CREATE POLICY "Student_card_views select own or admin" ON public.student_card_views
  FOR SELECT TO authenticated
  USING (viewer_id = (SELECT auth.uid()) OR public.is_admin());

REVOKE ALL ON TABLE public.student_card_views FROM anon;
GRANT SELECT ON TABLE public.student_card_views TO authenticated;
GRANT ALL ON TABLE public.student_card_views TO service_role;

-- נרשמת רק צפייה של מי שיש לו תפקיד שדכן, ולא של בעל הכרטיס עצמו.
-- מנהל שאינו שדכן לא נרשם: מנהלים פותחים כרטיסים לצורכי בקרה ותמיכה,
-- וזה רעש ולא "שדכן שפעל בשבילך". לא-שדכן מקבל no-op שקט ולא שגיאה -
-- זה רישום רקע שאסור לו להפיל את עמוד הכרטיס.
CREATE OR REPLACE FUNCTION public.record_student_card_view(p_student_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_student_id IS NULL THEN
    RETURN;
  END IF;
  IF NOT public.has_role(v_uid, 'shadchan') THEN
    RETURN;
  END IF;

  INSERT INTO public.student_card_views AS v (student_id, viewer_id)
  SELECT s.id, v_uid
  FROM public.students s
  WHERE s.id = p_student_id
    AND s.deleted_at IS NULL
    AND s.user_id <> v_uid
  ON CONFLICT (student_id, viewer_id) DO UPDATE
    SET last_viewed_at = now(),
        view_count     = v.view_count + 1;
END;
$$;

ALTER FUNCTION public.record_student_card_view(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.record_student_card_view(uuid)
  IS 'רושם צפייה של השדכן המחובר בכרטיס מיועד. no-op למי שאינו שדכן או לבעל הכרטיס.';

REVOKE ALL ON FUNCTION public.record_student_card_view(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_student_card_view(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_student_card_view(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_student_card_view(uuid) TO service_role;

-- ── 2. הכרטיס הציבורי של שדכן ─────────────────────────────────────
-- shadchanim_info סגורה ב-RLS לבעלים ולמנהל. כאן נחשפים רק שדות שהשדכן
-- מילא בטופס ההצטרפות לצורך פנייה אליו (contact_phone/contact_email,
-- ביוגרפיה, התמחויות) - לא הטלפון/המייל שאיתם הוא נרשם למערכת.
--
-- "שדכן משנת": אם השדכן הצהיר על שנות ניסיון, השנה מחושבת מול שנת
-- ההצהרה (ולא מול השנה הנוכחית, אחרת היא הייתה זזה כל שנה). בלי הצהרה -
-- שנת האישור/ההגשה, ובנפילה שנת ההרשמה למערכת.
--
-- פנימית בלבד: נקראת מתוך הפונקציות למטה, שאחראיות על ההרשאה.
CREATE OR REPLACE FUNCTION public.shadchan_public_profiles(p_ids uuid[])
RETURNS TABLE (
  shadchan_id      uuid,
  first_name       text,
  last_name        text,
  avatar_url       text,
  since_year       integer,
  phone            text,
  email            text,
  city             text,
  description      text,
  experience_years integer,
  closed_matches   integer,
  specializations  text[],
  languages        text[]
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT
    u.id,
    COALESCE(NULLIF(BTRIM(p.first_name), ''), NULLIF(BTRIM(u.raw_user_meta_data->>'firstName'), '')),
    COALESCE(NULLIF(BTRIM(p.last_name), ''),  NULLIF(BTRIM(u.raw_user_meta_data->>'lastName'), '')),
    NULLIF(BTRIM(u.raw_user_meta_data->>'avatar_url'), ''),
    CASE
      WHEN si.experience_years IS NOT NULL AND si.experience_years >= 0 THEN
        EXTRACT(YEAR FROM COALESCE(si.submitted_at, si.created_at))::integer - si.experience_years
      ELSE
        EXTRACT(YEAR FROM COALESCE(si.approved_at, si.submitted_at, si.created_at, u.created_at))::integer
    END,
    NULLIF(BTRIM(si.contact_phone), ''),
    NULLIF(BTRIM(si.contact_email), ''),
    NULLIF(BTRIM(si.location), ''),
    NULLIF(BTRIM(si.bio), ''),
    si.experience_years,
    si.closed_matches,
    COALESCE(si.specializations, '{}'),
    COALESCE(si.languages, '{}')
  FROM auth.users u
  LEFT JOIN public.user_profiles p ON p.id = u.id
  LEFT JOIN public.shadchanim_info si ON si.user_id = u.id
  WHERE u.id = ANY (p_ids);
$$;

ALTER FUNCTION public.shadchan_public_profiles(uuid[]) OWNER TO postgres;

COMMENT ON FUNCTION public.shadchan_public_profiles(uuid[])
  IS 'פנימית: שדות הכרטיס הציבורי של שדכנים. ההרשאה נבדקת בפונקציות שקוראות לה.';

REVOKE ALL ON FUNCTION public.shadchan_public_profiles(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shadchan_public_profiles(uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.shadchan_public_profiles(uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.shadchan_public_profiles(uuid[]) TO service_role;

-- עמוד "לפרופיל המלא". כל משתמש מחובר רשאי לראות כרטיס של שדכן - זו
-- מהות רשימת "השדכנים המומלצים" - אבל רק של מי שבאמת שדכן.
CREATE OR REPLACE FUNCTION public.get_shadchan_public_profile(p_shadchan_id uuid)
RETURNS TABLE (
  shadchan_id      uuid,
  first_name       text,
  last_name        text,
  avatar_url       text,
  since_year       integer,
  phone            text,
  email            text,
  city             text,
  description      text,
  experience_years integer,
  closed_matches   integer,
  specializations  text[],
  languages        text[]
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT pp.*
  FROM public.shadchan_public_profiles(ARRAY[p_shadchan_id]) pp
  WHERE auth.uid() IS NOT NULL
    AND public.is_contactable_shadchan(p_shadchan_id);
$$;

ALTER FUNCTION public.get_shadchan_public_profile(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.get_shadchan_public_profile(uuid)
  IS 'הכרטיס הציבורי של שדכן, למשתמש מחובר. ריק אם המזהה אינו של שדכן.';

REVOKE ALL ON FUNCTION public.get_shadchan_public_profile(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_shadchan_public_profile(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_shadchan_public_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_shadchan_public_profile(uuid) TO service_role;

-- ── 3. שדכנים שפעלו בשבילך ────────────────────────────────────────
-- "פעולה" עם כרטיס של אחד מילדי המשתמש המחובר (students.user_id - מאז
-- 20260907140000 הבעלות נקבעת מהסשן ואי אפשר להעביר אותה):
--   proposal       - הצעת שידוך שאינה טיוטה (טיוטה פרטית לשדכן), ורק אם
--                    הצד של ההורה היה נמען לפי recipient_scope - אחרת
--                    ההורה היה לומד על הצעה שלא נשלחה אליו (כמו במדיניות
--                    הקריאה של shidduchim מ-20260910100000)
--   view           - צפייה בכרטיס (student_card_views)
--   photo_request  - בקשה לצפות בתמונת המיועדת
--   message        - שדכן שפתח שיחה עם ההורה ("פניה למנהל הכרטיס" -
--                    הכפתור היחיד שבו שדכן פותח שיחה, והוא יושב על כרטיס)
-- הערות פנימיות על הכרטיס (student_notes) ושמירה ללוח העבודה לא נכללות:
-- הן כלי עבודה פרטי של השדכן, וחשיפתן להורה תחשוף מידע פנימי.
--
-- הכל נגזר מ-auth.uid() - אין פרמטר של "למי", ולכן אין דרך לבקש נתונים
-- של הורה אחר.
CREATE OR REPLACE FUNCTION public.get_shadchanim_who_acted_for_me(p_limit integer DEFAULT 6)
RETURNS TABLE (
  shadchan_id    uuid,
  first_name     text,
  last_name      text,
  avatar_url     text,
  since_year     integer,
  phone          text,
  email          text,
  city           text,
  description    text,
  last_action_at timestamptz,
  action_types   text[]
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  WITH me AS (
    SELECT auth.uid() AS uid
  ),
  my_students AS (
    SELECT s.id
    FROM public.students s, me
    WHERE s.user_id = me.uid
      AND s.deleted_at IS NULL
  ),
  actions AS (
    SELECT sh.shadchan_id AS actor_id,
           'proposal'::text AS action_type,
           COALESCE(sh.sent_at, sh.created_at) AS acted_at
    FROM public.shidduchim sh
    WHERE sh.status <> 'draft'
      AND ((sh.groom_id IN (SELECT id FROM my_students)
            AND sh.recipient_scope IN ('both', 'groom_only'))
        OR (sh.bride_id IN (SELECT id FROM my_students)
            AND sh.recipient_scope IN ('both', 'bride_only')))

    UNION ALL
    SELECT v.viewer_id, 'view', v.last_viewed_at
    FROM public.student_card_views v
    WHERE v.student_id IN (SELECT id FROM my_students)

    UNION ALL
    SELECT r.requester_id, 'photo_request', r.created_at
    FROM public.photo_view_requests r
    WHERE r.student_id IN (SELECT id FROM my_students)

    UNION ALL
    SELECT cr.created_by, 'message', cr.created_at
    FROM public.chat_rooms cr, me
    WHERE (cr.user_a = me.uid OR cr.user_b = me.uid)
      AND cr.created_by <> me.uid
  ),
  per_actor AS (
    SELECT a.actor_id,
           MAX(a.acted_at) AS last_action_at,
           ARRAY_AGG(DISTINCT a.action_type ORDER BY a.action_type) AS action_types
    FROM actions a, me
    WHERE a.actor_id <> me.uid
      AND public.is_contactable_shadchan(a.actor_id)
    GROUP BY a.actor_id
    ORDER BY MAX(a.acted_at) DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 6), 1), 50)
  )
  SELECT pp.shadchan_id, pp.first_name, pp.last_name, pp.avatar_url, pp.since_year,
         pp.phone, pp.email, pp.city, pp.description,
         pa.last_action_at, pa.action_types
  FROM per_actor pa
  JOIN public.shadchan_public_profiles(ARRAY(SELECT actor_id FROM per_actor)) pp
    ON pp.shadchan_id = pa.actor_id
  ORDER BY pa.last_action_at DESC;
$$;

ALTER FUNCTION public.get_shadchanim_who_acted_for_me(integer) OWNER TO postgres;

COMMENT ON FUNCTION public.get_shadchanim_who_acted_for_me(integer)
  IS 'שדכנים שהציעו שידוך, צפו בכרטיס, ביקשו תמונה או פנו בצ''אט - עבור כרטיסי המשתמש המחובר בלבד. ממוין לפי הפעולה האחרונה.';

REVOKE ALL ON FUNCTION public.get_shadchanim_who_acted_for_me(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_shadchanim_who_acted_for_me(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_shadchanim_who_acted_for_me(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_shadchanim_who_acted_for_me(integer) TO service_role;

-- ── 4. מכסת פניות יומית ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shadchan_contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shadchan_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_day date NOT NULL DEFAULT public.israel_today(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_id, contact_day, shadchan_id)
);

COMMENT ON TABLE  public.shadchan_contacts             IS 'פניות של הורים לשדכנים - בסיס למכסה היומית. שורה אחת לשדכן ליום. נכתבת רק דרך claim_shadchan_contact';
COMMENT ON COLUMN public.shadchan_contacts.parent_id   IS 'ההורה שפנה';
COMMENT ON COLUMN public.shadchan_contacts.shadchan_id IS 'השדכן שאליו פנו';
COMMENT ON COLUMN public.shadchan_contacts.contact_day IS 'היום בשעון ישראל - המכסה נספרת לפיו';

-- המפתח הייחודי (parent_id, contact_day, ...) משרת את ספירת "היום";
-- זה משרת את מחיקת ה-CASCADE של שדכן.
CREATE INDEX IF NOT EXISTS idx_shadchan_contacts_shadchan_id
  ON public.shadchan_contacts (shadchan_id);

ALTER TABLE public.shadchan_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shadchan_contacts select own or admin" ON public.shadchan_contacts;
CREATE POLICY "Shadchan_contacts select own or admin" ON public.shadchan_contacts
  FOR SELECT TO authenticated
  USING (parent_id = (SELECT auth.uid()) OR public.is_admin());

REVOKE ALL ON TABLE public.shadchan_contacts FROM anon;
GRANT SELECT ON TABLE public.shadchan_contacts TO authenticated;
GRANT ALL ON TABLE public.shadchan_contacts TO service_role;

CREATE OR REPLACE FUNCTION public.is_shadchan_contact_limit_exempt(uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT public.has_role(uid, 'shadchan') OR public.has_role(uid, 'admin');
$$;

ALTER FUNCTION public.is_shadchan_contact_limit_exempt(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.is_shadchan_contact_limit_exempt(uuid)
  IS 'שדכנים ומנהלים פטורים ממכסת הפניות היומית';

-- שדכנים ששלחו להורה הצעת שידוך (לצד שלו, לפי recipient_scope). הם פנו
-- אליו ראשונים, ולכן מענה להם - מתוך ההצעה או מכרטיס השדכן - אינו פנייה
-- חדשה ואינו נספר במכסה. בלי זה הורה שמיצה את המכסה לא יכול היה להשיב
-- לשדכן שהציע לו שידוך.
CREATE OR REPLACE FUNCTION public.shadchanim_who_proposed_to_parent(p_parent_id uuid) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT DISTINCT sh.shadchan_id
  FROM public.shidduchim sh
  JOIN public.students s
    ON (s.id = sh.groom_id AND sh.recipient_scope IN ('both', 'groom_only'))
    OR (s.id = sh.bride_id AND sh.recipient_scope IN ('both', 'bride_only'))
  WHERE s.user_id = p_parent_id
    AND s.deleted_at IS NULL
    AND sh.status <> 'draft';
$$;

ALTER FUNCTION public.shadchanim_who_proposed_to_parent(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.shadchanim_who_proposed_to_parent(uuid)
  IS 'פנימית: שדכנים ששלחו הצעת שידוך לצד של ההורה - מענה להם פטור ממכסת הפניות.';

REVOKE ALL ON FUNCTION public.shadchanim_who_proposed_to_parent(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shadchanim_who_proposed_to_parent(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.shadchanim_who_proposed_to_parent(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.shadchanim_who_proposed_to_parent(uuid) TO service_role;

-- רושם פנייה, או זורק daily_contact_limit_reached אם המכסה מוצתה.
-- אידמפוטנטית ליום: פנייה חוזרת לאותו שדכן לא נספרת שוב, ולכן
-- contact_shadchan והטריגר על chat_rooms יכולים שניהם לקרוא לה.
-- הנעילה מונעת ממספר בקשות מקבילות לעבור יחד את בדיקת הספירה.
CREATE OR REPLACE FUNCTION public.claim_shadchan_contact(p_parent_id uuid, p_shadchan_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_day  date := public.israel_today();
  v_used integer;
BEGIN
  IF p_parent_id IS NULL OR p_shadchan_id IS NULL THEN
    RETURN;
  END IF;
  IF public.is_shadchan_contact_limit_exempt(p_parent_id) THEN
    RETURN;
  END IF;
  -- מענה לשדכן שהציע להורה שידוך אינו פנייה חדשה
  IF p_shadchan_id IN (SELECT public.shadchanim_who_proposed_to_parent(p_parent_id)) THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('shadchan_contacts'), hashtext(p_parent_id::text));

  IF EXISTS (
    SELECT 1 FROM public.shadchan_contacts c
    WHERE c.parent_id = p_parent_id
      AND c.contact_day = v_day
      AND c.shadchan_id = p_shadchan_id
  ) THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_used
  FROM public.shadchan_contacts c
  WHERE c.parent_id = p_parent_id
    AND c.contact_day = v_day;

  IF v_used >= public.shadchan_daily_contact_limit() THEN
    RAISE EXCEPTION 'daily_contact_limit_reached'
      USING HINT = 'הגעת למכסת הפניות היומית לשדכנים. ניתן יהיה לפנות לשדכנים נוספים מחר.';
  END IF;

  INSERT INTO public.shadchan_contacts (parent_id, shadchan_id, contact_day)
  VALUES (p_parent_id, p_shadchan_id, v_day)
  ON CONFLICT (parent_id, contact_day, shadchan_id) DO NOTHING;
END;
$$;

ALTER FUNCTION public.claim_shadchan_contact(uuid, uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.claim_shadchan_contact(uuid, uuid)
  IS 'פנימית: רושם פנייה של הורה לשדכן ואוכף את המכסה היומית.';

-- פנימית: אחרת הורה יכול היה "לשרוף" מכסה של הורה אחר, או לרשום פניות בשמו.
REVOKE ALL ON FUNCTION public.claim_shadchan_contact(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_shadchan_contact(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.claim_shadchan_contact(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_shadchan_contact(uuid, uuid) TO service_role;

-- הצ'אט נפתח מהדפדפן (get_or_create_dm_room, או INSERT ישיר שה-RLS
-- מתיר ליוצר). הטריגר סוגר את העקיפה: הורה שפותח שיחה חדשה עם שדכן
-- נספר במכסה בכל מסלול, לא רק דרך טופס "פניה לשדכן". שיחה שהשדכן פתח
-- (created_by = השדכן) פטורה, כי היוצר עצמו פטור.
CREATE OR REPLACE FUNCTION public.enforce_shadchan_contact_limit_on_room() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_other uuid;
BEGIN
  v_other := CASE WHEN NEW.created_by = NEW.user_a THEN NEW.user_b ELSE NEW.user_a END;
  -- אותה הגדרת "שדכן" כמו ב-contact_shadchan (שדכן או מנהל)
  IF public.is_contactable_shadchan(v_other) THEN
    PERFORM public.claim_shadchan_contact(NEW.created_by, v_other);
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_shadchan_contact_limit_on_room() OWNER TO postgres;

COMMENT ON FUNCTION public.enforce_shadchan_contact_limit_on_room()
  IS 'סופר פתיחת שיחה חדשה של הורה עם שדכן במכסה היומית, בכל מסלול יצירת חדר.';

DROP TRIGGER IF EXISTS trigger_enforce_shadchan_contact_limit_on_room ON public.chat_rooms;
CREATE TRIGGER trigger_enforce_shadchan_contact_limit_on_room
  BEFORE INSERT ON public.chat_rooms
  FOR EACH ROW EXECUTE FUNCTION public.enforce_shadchan_contact_limit_on_room();

-- מצב המכסה למשתמש המחובר, לתצוגה בחלון הפנייה. contacted_shadchan_ids -
-- שדכנים שכבר פנו אליהם היום, כדי שהממשק לא יחסום פנייה חוזרת אליהם
-- גם כשהמכסה מלאה (היא לא נספרת שוב).
CREATE OR REPLACE FUNCTION public.get_my_shadchan_contact_quota()
RETURNS TABLE (
  daily_limit            integer,
  used_today             integer,
  remaining_today        integer,
  is_exempt              boolean,
  contacted_shadchan_ids uuid[],
  reply_shadchan_ids     uuid[]
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  WITH today AS (
    SELECT c.shadchan_id
    FROM public.shadchan_contacts c
    WHERE c.parent_id = auth.uid()
      AND c.contact_day = public.israel_today()
  )
  SELECT
    public.shadchan_daily_contact_limit(),
    (SELECT COUNT(*)::integer FROM today),
    GREATEST(public.shadchan_daily_contact_limit() - (SELECT COUNT(*)::integer FROM today), 0),
    public.is_shadchan_contact_limit_exempt(auth.uid()),
    COALESCE((SELECT ARRAY_AGG(shadchan_id) FROM today), '{}'),
    -- שדכנים שהציעו להורה שידוך - מענה להם לא נספר, והממשק לא חוסם אותו
    COALESCE((SELECT ARRAY_AGG(p.id) FROM public.shadchanim_who_proposed_to_parent(auth.uid()) AS p(id)), '{}')
  WHERE auth.uid() IS NOT NULL;
$$;

ALTER FUNCTION public.get_my_shadchan_contact_quota() OWNER TO postgres;

COMMENT ON FUNCTION public.get_my_shadchan_contact_quota()
  IS 'המכסה היומית, כמה נוצלו וכמה נותרו היום - למשתמש המחובר';

REVOKE ALL ON FUNCTION public.get_my_shadchan_contact_quota() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_shadchan_contact_quota() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_shadchan_contact_quota() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_shadchan_contact_quota() TO service_role;

-- ── 5. פניה לשדכן ─────────────────────────────────────────────────
-- פעולה אטומית אחת: בדיקת מכסה + פתיחת/איתור השיחה + ההודעה הראשונה.
-- אם אחד השלבים נכשל - שום דבר לא נרשם (גם לא ניצול מהמכסה).
-- auth.uid() נשאר של הקורא גם בתוך SECURITY DEFINER (הוא נקרא מה-JWT),
-- ולכן get_or_create_dm_room פותחת את השיחה בשמו.
CREATE OR REPLACE FUNCTION public.contact_shadchan(p_shadchan_id uuid, p_message text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  c_max_message_length CONSTANT integer := 2000;
  v_uid     uuid := auth.uid();
  v_message text := BTRIM(COALESCE(p_message, ''));
  v_room    uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication_required'
      USING HINT = 'פנייה לשדכן דורשת התחברות';
  END IF;
  IF p_shadchan_id IS NULL OR p_shadchan_id = v_uid
     OR NOT public.is_contactable_shadchan(p_shadchan_id) THEN
    RAISE EXCEPTION 'invalid_shadchan'
      USING HINT = 'השדכן המבוקש לא נמצא';
  END IF;
  IF v_message = '' THEN
    RAISE EXCEPTION 'message_required'
      USING HINT = 'יש לכתוב הודעה לשדכן';
  END IF;
  IF char_length(v_message) > c_max_message_length THEN
    RAISE EXCEPTION 'message_too_long'
      USING HINT = 'ההודעה ארוכה מדי';
  END IF;

  PERFORM public.claim_shadchan_contact(v_uid, p_shadchan_id);

  v_room := public.get_or_create_dm_room(p_shadchan_id);

  INSERT INTO public.chat_messages (room_id, sender_id, content)
  VALUES (v_room, v_uid, v_message);

  RETURN v_room;
END;
$$;

ALTER FUNCTION public.contact_shadchan(uuid, text) OWNER TO postgres;

COMMENT ON FUNCTION public.contact_shadchan(uuid, text)
  IS 'פניה לשדכן: אוכף מכסה יומית, פותח שיחה ושולח את ההודעה הראשונה. מחזיר room_id.';

REVOKE ALL ON FUNCTION public.contact_shadchan(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.contact_shadchan(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.contact_shadchan(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.contact_shadchan(uuid, text) TO service_role;
