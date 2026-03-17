import type { LucideIcon } from "lucide-react";

import type { MessageKey } from "@/lib/i18n/messages";

export type StorefrontNavTab = {
  href: string;
  labelKey: MessageKey;
  compactLabelKey?: MessageKey;
  icon: LucideIcon;
  permission: string;
};
