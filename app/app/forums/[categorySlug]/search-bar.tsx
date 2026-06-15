"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SearchBar({ defaultValue }: { defaultValue?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value) {
      params.set("search", e.target.value);
    } else {
      params.delete("search");
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}` as any);
    });
  }

  return (
    <div className="relative">
      <Search className="text-muted-foreground absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2" />
      <Input
        defaultValue={defaultValue}
        onChange={handleChange}
        placeholder="חיפוש נושאים..."
        className="ps-9"
      />
    </div>
  );
}
