"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { SlideUpSheet } from "@/components/ui/slide-up-sheet";
import { clearClientAuthToken, setClientAuthToken } from "@/lib/auth/client-token";
import { t } from "@/lib/i18n/messages";
import { useUiLocale } from "@/lib/i18n/use-ui-locale";

const loginSchema = z.object({
  email: z.string().email("กรอกอีเมลให้ถูกต้อง"),
  password: z.string().min(8, "รหัสผ่านอย่างน้อย 8 ตัวอักษร"),
});

type LoginInput = z.infer<typeof loginSchema>;

type LoginResponse = {
  ok?: boolean;
  blocked?: boolean;
  accountStatus?: "INVITED" | "SUSPENDED" | "NO_ACTIVE_STORE";
  next?: string;
  token?: string;
  message?: string;
  requiresPasswordChange?: boolean;
  email?: string;
};

const demoAccounts = [
  {
    id: "superadmin",
    label: "Superadmin",
    email: "spadmin@123.com",
    password: "123123123",
  },
  {
    id: "test-user",
    label: "Test",
    email: "test@123.com",
    password: "12341234",
  },
  {
    id: "staff",
    label: "Staff",
    email: "staff@gmail.com",
    password: "123123123",
  },
  {
    id: "system-admin",
    label: "System Admin",
    email: "systemadmin@demo-pos.local",
    password: "Admin@12345",
  },
  {
    id: "owner",
    label: "Owner",
    email: "owner@demo-pos.local",
    password: "password123",
  },
] as const;

export function LoginForm() {
  const router = useRouter();
  const uiLocale = useUiLocale();
  const [serverError, setServerError] = useState<string | null>(null);
  const [copiedAccountId, setCopiedAccountId] = useState<string | null>(null);
  const [isNavigatingAfterLogin, startNavigation] = useTransition();

  const [isForceChangeOpen, setIsForceChangeOpen] = useState(false);
  const [forceChangeEmail, setForceChangeEmail] = useState("");
  const [forceChangeCurrentPassword, setForceChangeCurrentPassword] = useState("");
  const [forceChangePassword, setForceChangePassword] = useState("");
  const [forceChangeConfirmPassword, setForceChangeConfirmPassword] = useState("");
  const [forceChangeError, setForceChangeError] = useState<string | null>(null);
  const [isForceChanging, setIsForceChanging] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "owner@demo-pos.local",
      password: "password123",
    },
  });

  const isLoginBusy = form.formState.isSubmitting || isNavigatingAfterLogin;

  const completeLogin = (data: LoginResponse | null) => {
    if (data?.token) {
      setClientAuthToken(data.token);
    } else {
      clearClientAuthToken();
    }

    startNavigation(() => {
      router.replace(data?.next ?? "/dashboard");
      router.refresh();
    });
  };

  const openForceChangeModal = (email: string, currentPassword: string, message?: string) => {
    setForceChangeEmail(email);
    setForceChangeCurrentPassword(currentPassword);
    setForceChangePassword("");
    setForceChangeConfirmPassword("");
    setForceChangeError(message ?? null);
    setIsForceChangeOpen(true);
  };

  const onSubmit = async (values: LoginInput) => {
    setServerError(null);
    setForceChangeError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(values),
    });

    const data = (await response.json().catch(() => null)) as LoginResponse | null;

    if (!response.ok) {
      setServerError(data?.message ?? (uiLocale === "en" ? "Sign in failed. Please try again." : "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่"));
      return;
    }

    if (data?.requiresPasswordChange) {
      openForceChangeModal(data.email ?? values.email, values.password, data.message);
      return;
    }

    completeLogin(data);
  };

  const submitForceChangePassword = async () => {
    setForceChangeError(null);

    if (forceChangePassword.trim().length < 8) {
      setForceChangeError("รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }

    if (forceChangePassword !== forceChangeConfirmPassword) {
      setForceChangeError("ยืนยันรหัสผ่านใหม่ไม่ตรงกัน");
      return;
    }

    if (forceChangePassword === forceChangeCurrentPassword) {
      setForceChangeError("รหัสผ่านใหม่ต้องไม่ซ้ำรหัสผ่านชั่วคราว");
      return;
    }

    setIsForceChanging(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: forceChangeEmail,
          password: forceChangeCurrentPassword,
          newPassword: forceChangePassword,
        }),
      });

      const data = (await response.json().catch(() => null)) as LoginResponse | null;
      if (!response.ok) {
        setForceChangeError(data?.message ?? "เปลี่ยนรหัสผ่านไม่สำเร็จ");
        return;
      }

      if (data?.requiresPasswordChange) {
        setForceChangeError(data.message ?? "ยังไม่สามารถเปลี่ยนรหัสผ่านได้");
        return;
      }

      setIsForceChangeOpen(false);
      completeLogin(data);
    } finally {
      setIsForceChanging(false);
    }
  };

  const closeForceChangeModal = () => {
    if (isForceChanging) {
      return;
    }
    setIsForceChangeOpen(false);
    setForceChangeError(null);
  };

  const fillDemoAccount = (account: (typeof demoAccounts)[number]) => {
    setServerError(null);
    form.setValue("email", account.email, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    form.setValue("password", account.password, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const copyDemoAccount = async (account: (typeof demoAccounts)[number]) => {
    if (typeof window === "undefined" || !window.navigator?.clipboard) {
      return;
    }

    try {
      await window.navigator.clipboard.writeText(`${account.email}\n${account.password}`);
      setCopiedAccountId(account.id);
      window.setTimeout(() => {
        setCopiedAccountId((currentId) => (currentId === account.id ? null : currentId));
      }, 1200);
    } catch {
      setCopiedAccountId(null);
    }
  };

  return (
    <>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            {t(uiLocale, "auth.form.email")}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
            disabled={isLoginBusy}
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
            autoComplete="current-password"
            className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
            disabled={isLoginBusy}
            {...form.register("password")}
          />
          <p className="text-xs text-red-600">{form.formState.errors.password?.message}</p>
        </div>

        {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}

        <Button className="h-11 w-full" type="submit" disabled={isLoginBusy} aria-busy={isLoginBusy}>
          {isLoginBusy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t(uiLocale, "auth.form.signingIn")}
            </>
          ) : (
            t(uiLocale, "auth.form.signIn")
          )}
        </Button>

        <section className="space-y-2 rounded-xl border bg-slate-50 p-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{t(uiLocale, "auth.form.demoAccounts.title")}</p>
            <p className="text-xs text-slate-600">{t(uiLocale, "auth.form.demoAccounts.description")}</p>
          </div>

          <ul className="space-y-2">
            {demoAccounts.map((account) => (
              <li
                key={account.id}
                className="flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {account.label}: {account.email}
                  </p>
                  <p className="truncate text-xs text-slate-500">รหัสผ่าน: *****</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 px-2.5 text-xs"
                    onClick={() => fillDemoAccount(account)}
                    disabled={isLoginBusy}
                  >
                    Fill
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 px-2.5 text-xs"
                    onClick={() => copyDemoAccount(account)}
                    disabled={isLoginBusy}
                  >
                    {copiedAccountId === account.id ? "Copied" : "Copy"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </form>

      <SlideUpSheet
        isOpen={isForceChangeOpen}
        onClose={closeForceChangeModal}
        title={t(uiLocale, "auth.form.forceChange.title")}
        description={forceChangeEmail}
        panelMaxWidthClass="min-[1200px]:max-w-md"
        disabled={isForceChanging}
      >
        <div className="space-y-3">
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {t(uiLocale, "auth.form.forceChange.hint")}
          </p>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-500" htmlFor="force-change-password">
              {t(uiLocale, "auth.form.forceChange.newPassword")}
            </label>
            <input
              id="force-change-password"
              type="password"
              value={forceChangePassword}
              onChange={(event) => setForceChangePassword(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-primary focus:ring-2"
              disabled={isForceChanging}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-500" htmlFor="force-change-confirm-password">
              {t(uiLocale, "auth.form.forceChange.confirmPassword")}
            </label>
            <input
              id="force-change-confirm-password"
              type="password"
              value={forceChangeConfirmPassword}
              onChange={(event) => setForceChangeConfirmPassword(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-primary focus:ring-2"
              disabled={isForceChanging}
            />
          </div>

          {forceChangeError ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {forceChangeError}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              onClick={closeForceChangeModal}
              disabled={isForceChanging}
            >
              {t(uiLocale, "auth.form.forceChange.later")}
            </Button>
            <Button
              type="button"
              className="h-10 rounded-xl"
              onClick={submitForceChangePassword}
              disabled={isForceChanging}
            >
              {isForceChanging ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t(uiLocale, "auth.form.forceChange.saving")}
                </>
              ) : (
                t(uiLocale, "auth.form.forceChange.save")
              )}
            </Button>
          </div>
        </div>
      </SlideUpSheet>
    </>
  );
}
