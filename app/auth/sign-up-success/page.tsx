import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Page() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">תודה שנרשמת!</CardTitle>
        <CardDescription>נא לבדוק את האימייל שלך לאישור</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
          נרשמת בהצלחה. נא לבדוק את האימייל שלך לאישור החשבון לפני התחברות.
        </p>
      </CardContent>
    </Card>
  );
}
