-- כיסוי ראש: "מטפחת על הפאה" מוחלף ב"פאה וכובע" לבקשת ההנהלה, ונוספה "פאה ובנד".
-- ערך enum חדש אינו שמיש באותה טרנזקציה שבה נוסף, ולכן המרת הנתונים
-- נמצאת במיגרציה הבאה (head_cover_wig_backfill).
ALTER TYPE public.head_cover_type_enum ADD VALUE IF NOT EXISTS 'wig_and_hat';
ALTER TYPE public.head_cover_type_enum ADD VALUE IF NOT EXISTS 'wig_and_band';
