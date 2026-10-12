import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  FORUM_POST_MAX,
  FORUM_TITLE_MAX,
  type ForumCategory,
} from "@/features/forums/lib/types";

export type PostFormValues = {
  categoryId: string;
  title: string;
  body: string;
};

/**
 * שדות הפוסט (נושא, כותרת, תוכן): משותפים ליצירה ולעריכה, כך שהטופס זהה.
 * הרכיב מבוקר - המצב והשליחה אצל הקורא.
 */
export default function PostFormFields({
  categories,
  values,
  onChange,
}: {
  categories: ForumCategory[];
  values: PostFormValues;
  onChange: (next: PostFormValues) => void;
}) {
  return (
    <div className="space-y-4">
      {categories.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="post-category">נושא</Label>
          <NativeSelect
            id="post-category"
            value={values.categoryId}
            onChange={(e) =>
              onChange({ ...values, categoryId: e.target.value })
            }
          >
            <NativeSelectOption value="">ללא נושא</NativeSelectOption>
            {categories.map((category) => (
              <NativeSelectOption key={category.id} value={category.id}>
                {category.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="post-title">כותרת</Label>
        <Input
          id="post-title"
          value={values.title}
          onChange={(e) => onChange({ ...values, title: e.target.value })}
          placeholder="נושא הפוסט..."
          maxLength={FORUM_TITLE_MAX}
          dir="rtl"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="post-body">תוכן</Label>
        <Textarea
          id="post-body"
          value={values.body}
          onChange={(e) => onChange({ ...values, body: e.target.value })}
          placeholder="כתוב את הפוסט כאן..."
          rows={6}
          maxLength={FORUM_POST_MAX}
          dir="rtl"
        />
      </div>
    </div>
  );
}
