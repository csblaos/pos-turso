"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Info, KeyRound, ShieldCheck, ShieldAlert, Waypoints } from "lucide-react";

import { SlideUpSheet } from "@/components/ui/slide-up-sheet";
import { OverflowTitle } from "@/components/ui/overflow-title";
import { t, type MessageKey } from "@/lib/i18n/messages";
import { useUiLocale } from "@/lib/i18n/use-ui-locale";

type SecurityStatusTone = "ok" | "warn" | "bad" | "neutral";

type SecuritySnapshotCard = {
  titleKey: MessageKey;
  helpKey: MessageKey;
  tone: SecurityStatusTone;
  rows: ReadonlyArray<{ labelKey: MessageKey; value: string; tone?: SecurityStatusTone }>;
};

type SystemSecuritySnapshotProps = {
  authCard: SecuritySnapshotCard;
  sessionsCard: SecuritySnapshotCard;
  accessCard: SecuritySnapshotCard;
};

const toneToPillClass = (tone: SecurityStatusTone) => {
  if (tone === "ok") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "warn") return "border-amber-200 bg-amber-50 text-amber-800";
  if (tone === "bad") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
};

const toneToIcon = (tone: SecurityStatusTone) => {
  if (tone === "ok") return ShieldCheck;
  if (tone === "warn") return ShieldAlert;
  if (tone === "bad") return ShieldAlert;
  return Waypoints;
};

const toneLabelKey: Record<SecurityStatusTone, MessageKey> = {
  ok: "systemAdmin.securityPage.tone.ok",
  warn: "systemAdmin.securityPage.tone.warn",
  bad: "systemAdmin.securityPage.tone.bad",
  neutral: "systemAdmin.securityPage.tone.neutral",
};

function SnapshotCard({
  card,
  icon,
  onOpenHelp,
  disabled,
  footer,
}: {
  card: SecuritySnapshotCard;
  icon: React.ComponentType<{ className?: string }>;
  onOpenHelp: () => void;
  disabled: boolean;
  footer?: React.ReactNode;
}) {
  const uiLocale = useUiLocale();
  const Icon = icon;
  const ToneIcon = toneToIcon(card.tone);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900">{t(uiLocale, card.titleKey)}</h2>
              <span
                className={[
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                  toneToPillClass(card.tone),
                ].join(" ")}
              >
                <ToneIcon className="h-3.5 w-3.5" />
                {t(uiLocale, toneLabelKey[card.tone])}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenHelp}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:pointer-events-none disabled:opacity-60"
          aria-label={t(uiLocale, card.helpKey)}
          title={t(uiLocale, card.helpKey)}
          disabled={disabled}
        >
          <Info className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {card.rows.map((row) => (
          <div
            key={row.labelKey}
            className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
          >
            <p className="text-xs font-medium text-slate-700">{t(uiLocale, row.labelKey)}</p>
            <OverflowTitle
              value={row.value}
              className={[
                "max-w-[56%] truncate rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                toneToPillClass(row.tone ?? "neutral"),
              ].join(" ")}
            />
          </div>
        ))}
      </div>

      {footer ? <div className="mt-3">{footer}</div> : null}
    </article>
  );
}

export function SystemSecuritySnapshot({ authCard, sessionsCard, accessCard }: SystemSecuritySnapshotProps) {
  const uiLocale = useUiLocale();
  const [helpTarget, setHelpTarget] = useState<"auth" | "sessions" | "access" | null>(null);

  const activeHelp =
    helpTarget === "auth"
      ? authCard
      : helpTarget === "sessions"
        ? sessionsCard
        : helpTarget === "access"
          ? accessCard
          : null;

  return (
    <>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <SnapshotCard
          card={authCard}
          icon={KeyRound}
          onOpenHelp={() => setHelpTarget("auth")}
          disabled={false}
        />
        <SnapshotCard
          card={sessionsCard}
          icon={Waypoints}
          onOpenHelp={() => setHelpTarget("sessions")}
          disabled={false}
          footer={
            <Link
              href="/system-admin/config/monitoring"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              {t(uiLocale, "systemAdmin.securityPage.action.viewSystemHealth")}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          }
        />
        <SnapshotCard
          card={accessCard}
          icon={ShieldCheck}
          onOpenHelp={() => setHelpTarget("access")}
          disabled={false}
        />
      </div>

      <SlideUpSheet
        isOpen={helpTarget !== null}
        onClose={() => setHelpTarget(null)}
        title={
          activeHelp ? t(uiLocale, activeHelp.titleKey) : t(uiLocale, "systemAdmin.securityPage.title")
        }
        description={activeHelp ? t(uiLocale, activeHelp.helpKey) : undefined}
      >
        <div className="space-y-2 text-sm text-slate-700" />
      </SlideUpSheet>
    </>
  );
}
