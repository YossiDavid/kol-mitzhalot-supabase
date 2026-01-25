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
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">בדוק את האימייל שלך</CardTitle>
            <CardDescription>
              שלחנו לך קישור להתחברות. לחץ על הקישור באימייל כדי להיכנס.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              לא קיבלת? בדוק בתיקיית ספאם או{" "}
              <Link href="/auth/login" className="underline underline-offset-4">
                נסה שוב
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
