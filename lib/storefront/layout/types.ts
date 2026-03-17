import type { StoreType } from "@/lib/storefront/types";
import type { MessageKey } from "@/lib/i18n/messages";

export type StorefrontLayoutPreset = {
  storeType: StoreType;
  shellTitleKey: MessageKey;
  appBgClassName: string;
  headerBgClassName: string;
  modeNoteTextKey: MessageKey | null;
  modeNoteClassName: string;
};
