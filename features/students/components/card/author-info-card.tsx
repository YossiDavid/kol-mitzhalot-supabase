import { Phone } from "lucide-react";

type AuthorInfo = {
  name?: string | null;
  relation?: string | null;
  phone?: string | null;
} | null;

/** "הקו״ח מולאו ע"י" - כרטיסון קטן בתחתית עמודת הצד */
export function AuthorInfoCard({ authorInfo }: { authorInfo: AuthorInfo }) {
  if (!authorInfo) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-1 text-caption font-bold tracking-widest text-muted-foreground uppercase">
        הקו״ח מולאו ע"י
      </p>
      <p className="text-body-sm font-bold">{authorInfo.name}</p>
      {authorInfo.relation && (
        <p className="text-caption text-muted-foreground">
          {authorInfo.relation}
        </p>
      )}
      {authorInfo.phone && (
        <a
          href={`tel:${authorInfo.phone}`}
          className="mt-1 flex items-center gap-1 text-caption text-muted-foreground hover:text-primary"
        >
          <Phone size={12} /> {authorInfo.phone}
        </a>
      )}
    </div>
  );
}
