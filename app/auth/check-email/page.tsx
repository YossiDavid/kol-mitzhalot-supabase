import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

export default function CheckEmailPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">בדוק את האימייל שלך</CardTitle>
        <CardDescription>
          שלחנו לך קישור להתחברות. לחץ על הקישור באימייל כדי להיכנס.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
          לא קיבלת? בדוק בתיקיית ספאם או{" "}
          <Link href="/auth/login" className="underline underline-offset-4">
            נסה שוב
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
