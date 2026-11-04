-- קו"ח ומסמכים רפואיים: נתיב בלבד במקום קישור חתום לשנה (ממצאים 3 ו-16).
--
-- עד עכשיו נשמר ב-students.cv_url וב-medical_records.documents קישור חתום
-- לשנה. מי שקיבל אותו פעם (הצד השני בהצעה שנסגרה, שדכן שהוקפא) המשיך לפתוח
-- את הקובץ שנה שלמה, ואי אפשר היה לבטל. עכשיו נשמר הנתיב (<student_id>/...),
-- והקישור נחתם לכמה דקות בכל צפייה (/api/v1/students/[id]/files, אחרי בדיקת
-- הרשאה).
--
-- 1. המרה: מחלצים את הנתיב מכל קישור חתום קיים (בפרודקשן: 170 קו"ח ו-4
--    מסמכים, כולם בתיקיית הכרטיס).
-- 2. trigger: ערך שנכתב חייב להיות נתיב בתיקיית הכרטיס. קישור חתום ישן (מלקוח
--    שעוד לא התעדכן) מומר לנתיב; כתובת חיצונית נדחית - כך אי אפשר עוד לשים
--    ב-cv_url קישור לאתר אחר (ממצא 16).
--
-- הערה: הקישורים שכבר יצאו עדיין תקפים עד שיפוגו (שנה מההעלאה). לביטולם יש
-- להריץ את scripts/rotate-student-documents.mjs (מעביר כל קובץ לנתיב חדש).
--
-- ROLLBACK: DROP TRIGGER trigger_normalize_student_cv_path ON public.students;
--           DROP TRIGGER trigger_normalize_medical_document_paths ON public.medical_records;
--           (הנתיבים נשארים; הקוד הישן ציפה לקישור מלא)

CREATE OR REPLACE FUNCTION public.student_file_path(p_value text, p_student_id uuid)
RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  v_path text := btrim(p_value);
BEGIN
  IF v_path IS NULL OR v_path = '' THEN
    RETURN NULL;
  END IF;
  IF v_path LIKE '%/object/sign/students/%' THEN
    v_path := split_part(substring(v_path FROM '/object/sign/students/(.*)$'), '?', 1);
  END IF;
  IF v_path LIKE '%://%' OR v_path LIKE '%..%'
     OR v_path NOT LIKE p_student_id::text || '/%' THEN
    RAISE EXCEPTION 'invalid_student_file_path'
      USING ERRCODE = '22023', HINT = 'קובץ הכרטיס חייב להיות בתיקיית הכרטיס';
  END IF;
  RETURN v_path;
END;
$$;

ALTER FUNCTION public.student_file_path(text, uuid) OWNER TO postgres;
-- חישוב טהור (בלי גישה לנתונים); ה-triggers רצים בהרשאות הכותב, ולכן
-- authenticated חייב להריץ אותה
REVOKE ALL ON FUNCTION public.student_file_path(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_file_path(text, uuid) TO authenticated, service_role;

-- ── 1. המרה ──────────────────────────────────────────────────────────
UPDATE public.students
   SET cv_url = public.student_file_path(cv_url, id)
 WHERE cv_url IS NOT NULL;

UPDATE public.medical_records mr
   SET documents = (
     SELECT array_agg(public.student_file_path(d, mr.student_id) ORDER BY ord)
       FROM unnest(mr.documents) WITH ORDINALITY AS u(d, ord)
      WHERE d IS NOT NULL AND btrim(d) <> ''
   )
 WHERE mr.documents IS NOT NULL AND cardinality(mr.documents) > 0;

-- ── 2. כתיבה: נתיב בתיקיית הכרטיס בלבד ───────────────────────────────
CREATE OR REPLACE FUNCTION public.normalize_student_cv_path() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.cv_url := public.student_file_path(NEW.cv_url, NEW.id);
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.normalize_student_cv_path() OWNER TO postgres;

DROP TRIGGER IF EXISTS trigger_normalize_student_cv_path ON public.students;
CREATE TRIGGER trigger_normalize_student_cv_path
  BEFORE INSERT OR UPDATE OF cv_url ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.normalize_student_cv_path();

CREATE OR REPLACE FUNCTION public.normalize_medical_document_paths() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.documents IS NOT NULL THEN
    NEW.documents := (
      SELECT array_agg(public.student_file_path(d, NEW.student_id) ORDER BY ord)
        FROM unnest(NEW.documents) WITH ORDINALITY AS u(d, ord)
       WHERE d IS NOT NULL AND btrim(d) <> ''
    );
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.normalize_medical_document_paths() OWNER TO postgres;

DROP TRIGGER IF EXISTS trigger_normalize_medical_document_paths ON public.medical_records;
CREATE TRIGGER trigger_normalize_medical_document_paths
  BEFORE INSERT OR UPDATE OF documents ON public.medical_records
  FOR EACH ROW EXECUTE FUNCTION public.normalize_medical_document_paths();
