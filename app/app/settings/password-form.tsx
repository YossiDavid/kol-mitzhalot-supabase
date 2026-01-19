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

interface PasswordFormData {
  newPassword: string;
  confirmPassword: string;
}

export function PasswordForm() {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<PasswordFormData>({
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: PasswordFormData) => {
    if (data.newPassword !== data.confirmPassword) {
      form.setError("confirmPassword", {
        type: "manual",
        message: "הסיסמאות אינן תואמות",
      });
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    try {
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (error) throw error;

      toast.success("הסיסמה עודכנה בהצלחה");
      form.reset();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "אירעה שגיאה בעדכון הסיסמה";
      toast.error(errorMessage);
      console.error("Error updating password:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>שינוי סיסמה</CardTitle>
        <CardDescription>עדכן את הסיסמה שלך</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control as any}
              name="newPassword"
              rules={{
                required: "סיסמה חדשה היא שדה חובה",
                minLength: {
                  value: 6,
                  message: "הסיסמה חייבת להכיל לפחות 6 תווים",
                },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>סיסמה חדשה</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="הכנס סיסמה חדשה"
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control as any}
              name="confirmPassword"
              rules={{
                required: "אימות סיסמה הוא שדה חובה",
                validate: (value) => {
                  const newPassword = form.getValues("newPassword");
                  return (
                    value === newPassword || "הסיסמאות אינן תואמות"
                  );
                },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>אימות סיסמה</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="הכנס שוב את הסיסמה החדשה"
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? "שומר..." : "שמור סיסמה חדשה"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}


