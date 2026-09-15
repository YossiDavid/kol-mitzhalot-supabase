# נתוני בדיקה לתבנית SendGrid — הצעת שידוך

קובץ: [`shidduch-offer.test-data.json`](./shidduch-offer.test-data.json)

## איך לבדוק בעורך SendGrid

1. פתחו **Dynamic Templates** → בחרו את תבנית `shidduch-offer` (או השם שנתתם).
2. בעורך התבנית, חפשו שדה **Test Data** / **Substitution tags** / הדמיית תצוגה (השם משתנה בין גרסאות).
3. הדביקו את כל תוכן הקובץ:

```json
{
  "shadchan_name": "משה כהן",
  "subject": "התקבלה הצעת שידוך חדשה",
  "offer_url": "https://example.com/app/shidduchim/00000000-0000-4000-8000-000000000001"
}
```

## הערה

המייל זהה לכל הנמענים ואינו כולל שמות מיועדים או הערות, ולכן אין יותר סצנאות נפרדות לפי צד.
