"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { setClientAuthToken } from "@/lib/auth/client-token";
import { t } from "@/lib/i18n/messages";
import { useUiLocale } from "@/lib/i18n/use-ui-locale";

const signupSchema = z
  .object({
    name: z.string().min(2, "กรอกชื่ออย่างน้อย 2 ตัวอักษร"),
    email: z.string().email("กรอกอีเมลให้ถูกต้อง"),
    password: z.string().min(8, "รหัสผ่านอย่างน้อย 8 ตัวอักษร"),
    confirmPassword: z.string().min(8, "ยืนยันรหัสผ่านอย่างน้อย 8 ตัวอักษร"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "รหัสผ่านไม่ตรงกัน",
  });

type SignupInput = z.infer<typeof signupSchema>;

export function SignupForm() {
  const router = useRouter();
  const uiLocale = useUiLocale();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: SignupInput) => {
    setServerError(null);

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: values.name,
        email: values.email,
        password: values.password,
      }),
    });

    const data = (await response.json().catch(() => null)) as
      | { next?: string; token?: string; message?: string }
      | null;

    if (!response.ok) {
      setServerError(data?.message ?? (uiLocale === "en" ? "Sign up failed. Please try again." : "สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่"));
      return;
    }

    if (data?.token) {
      setClientAuthToken(data.token);
    }

    router.replace(data?.next ?? "/onboarding");
    router.refresh();
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          {t(uiLocale, "auth.form.name")}
        </label>
        <input
          id="name"
          className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
          {...form.register("name")}
        />
        <p className="text-xs text-red-600">{form.formState.errors.name?.message}</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          {t(uiLocale, "auth.form.email")}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
          {...form.register("email")}
        />
        <p className="text-xs text-red-600">{form.formState.errors.email?.message}</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          {t(uiLocale, "auth.form.password")}
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
          {...form.register("password")}
        />
        <p className="text-xs text-red-600">{form.formState.errors.password?.message}</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="confirmPassword" className="text-sm font-medium">
          {t(uiLocale, "auth.form.confirmPassword")}
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
          {...form.register("confirmPassword")}
        />
        <p className="text-xs text-red-600">
          {form.formState.errors.confirmPassword?.message}
        </p>
      </div>

      {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}

      <Button className="h-11 w-full" type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? t(uiLocale, "auth.form.signingUp") : t(uiLocale, "auth.form.signUp")}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t(uiLocale, "auth.form.alreadyHaveAccount")}{" "}
        <Link href="/login" className="font-medium text-blue-700 hover:underline">
          {t(uiLocale, "auth.form.signIn")}
        </Link>
      </p>
    </form>
  );
}
