import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { PageTitle } from "@/components/layout/page-header";
import Link from "next/link";

export default function CheckEmailPage() {
  return (
    <Card>
      <CardHeader>
        <PageTitle>בדוק את האימייל שלך</PageTitle>
        <CardDescription>
          שלחנו לך קישור להתחברות. לחץ על הקישור באימייל כדי להיכנס.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-body-sm">
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
