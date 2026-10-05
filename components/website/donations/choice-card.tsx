import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ChoiceCardProps {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * אפשרות בחירה (radio) בצורת כרטיס. ה-input האמיתי מוסתר חזותית אך נגיש
 * למקלדת ולקורא מסך, והמצב הנבחר/הממוקד מסומן על ה-label.
 */
export function ChoiceCard({
  name,
  value,
  checked,
  onSelect,
  children,
  className,
}: ChoiceCardProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center justify-center rounded-lg border border-input bg-card px-4 py-3 text-center transition-colors hover:border-primary",
        "has-[input:checked]:border-primary has-[input:checked]:bg-primary-muted has-[input:checked]:text-primary",
        "has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50",
        className,
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      {children}
    </label>
  );
}
