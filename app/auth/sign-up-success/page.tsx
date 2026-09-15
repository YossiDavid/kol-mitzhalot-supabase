import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { PageTitle } from "@/components/layout/page-header";

export default function Page() {
  return (
    <Card>
      <CardHeader>
        <PageTitle>תודה שנרשמת!</PageTitle>
        <CardDescription>נא לבדוק את האימייל שלך לאישור</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-body-sm">
          נרשמת בהצלחה. נא לבדוק את האימייל שלך לאישור החשבון לפני התחברות.
        </p>
      </CardContent>
    </Card>
  );
}
