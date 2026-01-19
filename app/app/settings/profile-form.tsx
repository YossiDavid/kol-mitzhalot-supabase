"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
}

interface ProfileFormProps {
  initialData: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  };
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const form = useForm<ProfileFormData>({
    defaultValues: {
      firstName: initialData.firstName || "",
      lastName: initialData.lastName || "",
      email: initialData.email || "",
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    setIsLoading(true);
    const supabase = createClient();

    try {
      // Update user metadata
      const { error } = await supabase.auth.updateUser({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
        },
        email: data.email !== initialData.email ? data.email : undefined,
      });

      if (error) throw error;

      toast.success("הפרופיל עודכן בהצלחה");
      router.refresh();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "אירעה שגיאה בעדכון הפרופיל";
      toast.error(errorMessage);
      console.error("Error updating profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>פרטים אישיים</CardTitle>
        <CardDescription>עדכן את פרטי הפרופיל שלך</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control as any}
              name="firstName"
              rules={{ required: "שם פרטי הוא שדה חובה" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם פרטי</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="הכנס שם פרטי"
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control as any}
              name="lastName"
              rules={{ required: "שם משפחה הוא שדה חובה" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם משפחה</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="הכנס שם משפחה"
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control as any}
              name="email"
              rules={{
                required: "אימייל הוא שדה חובה",
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: "אימייל לא תקין",
                },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>אימייל</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="הכנס אימייל"
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? "שומר..." : "שמור שינויים"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
