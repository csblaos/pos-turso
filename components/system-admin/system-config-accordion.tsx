"use client";

import { useState } from "react";
import { ChevronDown, Clock, GitBranch, Image as ImageIcon } from "lucide-react";

import { SystemBranchPolicyConfig } from "@/components/system-admin/system-branch-policy-config";
import { SystemSessionPolicyConfig } from "@/components/system-admin/system-session-policy-config";
import { SystemStoreLogoPolicyConfig } from "@/components/system-admin/system-store-logo-policy-config";
import { t } from "@/lib/i18n/messages";
import { useUiLocale } from "@/lib/i18n/use-ui-locale";

type SystemConfigAccordionProps = {
  initialBranchPolicy: {
    defaultCanCreateBranches: boolean;
    defaultMaxBranchesPerStore: number | null;
  };
  initialSessionPolicy: {
    defaultSessionLimit: number;
  };
  initialStoreLogoPolicy: {
    maxSizeMb: number;
    autoResize: boolean;
    resizeMaxWidth: number;
  };
};

type SectionId = "branches" | "sessions" | "storeLogo";

export function SystemConfigAccordion({
  initialBranchPolicy,
  initialSessionPolicy,
  initialStoreLogoPolicy,
}: SystemConfigAccordionProps) {
  const uiLocale = useUiLocale();
  const [openId, setOpenId] = useState<SectionId | null>(null);

  const sections = [
    {
      id: "branches" as const,
      icon: GitBranch,
      titleKey: "systemAdmin.branchPolicy.title" as const,
      descriptionKey: "systemAdmin.branchPolicy.description" as const,
      content: <SystemBranchPolicyConfig initialConfig={initialBranchPolicy} variant="embedded" />,
    },
    {
      id: "sessions" as const,
      icon: Clock,
      titleKey: "systemAdmin.sessionPolicy.title" as const,
      descriptionKey: "systemAdmin.sessionPolicy.description" as const,
      content: (
        <SystemSessionPolicyConfig initialConfig={initialSessionPolicy} variant="embedded" />
      ),
    },
    {
      id: "storeLogo" as const,
      icon: ImageIcon,
      titleKey: "systemAdmin.storeLogoPolicy.title" as const,
      descriptionKey: "systemAdmin.storeLogoPolicy.description" as const,
      content: (
        <SystemStoreLogoPolicyConfig initialConfig={initialStoreLogoPolicy} variant="embedded" />
      ),
    },
  ];

  return (
    <div className="space-y-3">
      {sections.map((section) => {
        const Icon = section.icon;
        const isOpen = openId === section.id;

        return (
          <div
            key={section.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <button
              type="button"
              className="flex w-full items-start justify-between gap-3 p-4 text-left"
              aria-expanded={isOpen}
              onClick={() => setOpenId((prev) => (prev === section.id ? null : section.id))}
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-slate-900">
                    {t(uiLocale, section.titleKey)}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {t(uiLocale, section.descriptionKey)}
                  </p>
                </div>
              </div>

              <span
                className={[
                  "mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition",
                  isOpen ? "rotate-180 border-blue-200 bg-blue-50 text-blue-700" : "",
                ].join(" ")}
              >
                <ChevronDown className="h-4 w-4" />
              </span>
            </button>

            <div
              className={[
                "grid transition-[grid-template-rows] duration-200 ease-out",
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              ].join(" ")}
            >
              <div className="overflow-hidden">
                <div className="border-t border-slate-200 p-4">{section.content}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

