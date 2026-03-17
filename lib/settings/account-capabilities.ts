import { isPermissionGranted } from "@/lib/rbac/access";
import { type UiLocale } from "@/lib/i18n/locales";
import { type MessageKey, t } from "@/lib/i18n/messages";

export type UserCapability = {
  id: string;
  title: string;
  description: string;
  granted: boolean;
};

type CapabilityConfig = {
  id: string;
  permissionKey: string;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
};

const capabilityConfigs: CapabilityConfig[] = [
  {
    id: "settings.view",
    permissionKey: "settings.view",
    titleKey: "settings.permissions.capability.settings.view.title",
    descriptionKey: "settings.permissions.capability.settings.view.description",
  },
  {
    id: "settings.update",
    permissionKey: "settings.update",
    titleKey: "settings.permissions.capability.settings.update.title",
    descriptionKey: "settings.permissions.capability.settings.update.description",
  },
  {
    id: "members.view",
    permissionKey: "members.view",
    titleKey: "settings.permissions.capability.members.view.title",
    descriptionKey: "settings.permissions.capability.members.view.description",
  },
  {
    id: "rbac.roles.view",
    permissionKey: "rbac.roles.view",
    titleKey: "settings.permissions.capability.rbac.roles.view.title",
    descriptionKey: "settings.permissions.capability.rbac.roles.view.description",
  },
  {
    id: "units.view",
    permissionKey: "units.view",
    titleKey: "settings.permissions.capability.units.view.title",
    descriptionKey: "settings.permissions.capability.units.view.description",
  },
  {
    id: "reports.view",
    permissionKey: "reports.view",
    titleKey: "settings.permissions.capability.reports.view.title",
    descriptionKey: "settings.permissions.capability.reports.view.description",
  },
  {
    id: "connections.view",
    permissionKey: "connections.view",
    titleKey: "settings.permissions.capability.connections.view.title",
    descriptionKey: "settings.permissions.capability.connections.view.description",
  },
];

export function buildUserCapabilities(permissionKeys: string[], uiLocale: UiLocale): UserCapability[] {
  return capabilityConfigs.map((item) => ({
    id: item.id,
    title: t(uiLocale, item.titleKey),
    description: t(uiLocale, item.descriptionKey),
    granted: isPermissionGranted(permissionKeys, item.permissionKey),
  }));
}
