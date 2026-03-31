"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

import { RolesListHelpButton } from "@/components/app/roles-list-help-button";
import { Button } from "@/components/ui/button";
import { uiLocaleToDateLocale, type UiLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";

type PermissionRow = {
  id: string;
  key: string;
  resource: string;
  action: string;
};

type RolePermissionEditorProps = {
  roleId: string;
  roleName: string;
  locked: boolean;
  canManage: boolean;
  permissions: PermissionRow[];
  assignedPermissionKeys: string[];
  uiLocale: UiLocale;
};

const actionColumns = ["view", "create", "update", "delete", "export", "approve"] as const;

const localizeText = (uiLocale: UiLocale, th: string, lo: string, en: string) =>
  uiLocale === "lo" ? lo : uiLocale === "en" ? en : th;

function isSameSet(left: Set<string>, right: Set<string>) {
  if (left.size !== right.size) {
    return false;
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }

  return true;
}

export function RolePermissionsEditor({
  roleId,
  roleName,
  locked,
  canManage,
  permissions,
  assignedPermissionKeys,
  uiLocale,
}: RolePermissionEditorProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const saveSectionRef = useRef<HTMLDivElement | null>(null);
  const [isSaveSectionVisible, setIsSaveSectionVisible] = useState(true);

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    () => new Set(assignedPermissionKeys),
  );
  const [savedKeys, setSavedKeys] = useState<Set<string>>(
    () => new Set(assignedPermissionKeys),
  );

  const permissionMap = useMemo(() => new Map(permissions.map((item) => [item.key, item])), [permissions]);
  const hasUnsavedChanges = useMemo(
    () => !isSameSet(selectedKeys, savedKeys),
    [selectedKeys, savedKeys],
  );
  const showFloatingScrollButton = hasUnsavedChanges && !isSaveSectionVisible;
  const numberLocale = uiLocaleToDateLocale(uiLocale);

  const actionLabelMap = useMemo(
    () => ({
      view: localizeText(uiLocale, "ดู", "ເບິ່ງ", "View"),
      create: localizeText(uiLocale, "สร้าง", "ສ້າງ", "Create"),
      update: localizeText(uiLocale, "แก้ไข", "ແກ້ໄຂ", "Update"),
      delete: localizeText(uiLocale, "ลบ", "ລຶບ", "Delete"),
      export: localizeText(uiLocale, "ส่งออก", "ສົ່ງອອກ", "Export"),
      approve: localizeText(uiLocale, "อนุมัติ", "ອະນຸມັດ", "Approve"),
    }),
    [uiLocale],
  );

  const moduleLabelMap = useMemo(
    () => ({
      dashboard: localizeText(uiLocale, "แดชบอร์ด", "ແດຊບອດ", "Dashboard"),
      orders: localizeText(uiLocale, "คำสั่งซื้อ", "ຄຳສັ່ງຊື້", "Orders"),
      products: localizeText(uiLocale, "สินค้า", "ສິນຄ້າ", "Products"),
      inventory: localizeText(uiLocale, "สต็อก", "ສະຕັອກ", "Inventory"),
      contacts: localizeText(uiLocale, "ลูกค้า", "ລູກຄ້າ", "Contacts"),
      members: localizeText(uiLocale, "สมาชิกทีม", "ສະມາຊິກທີມ", "Members"),
      reports: localizeText(uiLocale, "รายงาน", "ລາຍງານ", "Reports"),
      settings: localizeText(uiLocale, "ตั้งค่า", "ຕັ້ງຄ່າ", "Settings"),
      connections: localizeText(uiLocale, "การเชื่อมต่อ", "ການເຊື່ອມຕໍ່", "Connections"),
      stores: localizeText(uiLocale, "ข้อมูลร้าน", "ຂໍ້ມູນຮ້ານ", "Stores"),
      units: localizeText(uiLocale, "หน่วยสินค้า", "ໜ່ວຍສິນຄ້າ", "Units"),
      "rbac.roles": localizeText(uiLocale, "บทบาท", "ບົດບາດ", "Roles"),
      "rbac.permissions": localizeText(uiLocale, "สิทธิ์ระบบ", "ສິດລະບົບ", "Permissions"),
    }),
    [uiLocale],
  );

  const resources = useMemo(() => {
    const set = new Set<string>();
    for (const permission of permissions) {
      set.add(permission.resource);
    }

    return [...set].sort((a, b) => a.localeCompare(b));
  }, [permissions]);

  const togglePermission = (permissionKey: string) => {
    setSelectedKeys((previous) => {
      const next = new Set(previous);
      if (next.has(permissionKey)) {
        next.delete(permissionKey);
      } else {
        next.add(permissionKey);
      }

      return next;
    });
  };

  const scrollToSave = () => {
    saveSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  useEffect(() => {
    const element = saveSectionRef.current;
    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSaveSectionVisible(entry.isIntersecting);
      },
      { threshold: 0.25 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const onSave = async () => {
    setSaving(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/settings/roles/${roleId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          permissionKeys: [...selectedKeys],
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            message?: string;
          }
        | null;

      if (!response.ok) {
        setErrorMessage(data?.message ?? t(uiLocale, "settings.roles.detail.error.saveFailed"));
        return;
      }

      setSavedKeys(new Set(selectedKeys));
      toast.success(t(uiLocale, "settings.roles.detail.toast.saved"));
      router.refresh();
    } catch {
      setErrorMessage(t(uiLocale, "settings.roles.detail.error.network"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4 pb-4 sm:pb-20">
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold text-slate-900">{roleName}</p>
              <span
                className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
                  hasUnsavedChanges
                    ? "border border-amber-200 bg-amber-50 text-amber-700"
                    : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {hasUnsavedChanges
                  ? t(uiLocale, "settings.roles.detail.status.unsaved")
                  : t(uiLocale, "settings.roles.detail.status.saved")}
              </span>
            </div>
            <p className="text-sm text-slate-500">{t(uiLocale, "settings.roles.detail.subtitle")}</p>
          </div>

          <div className="shrink-0">
            <RolesListHelpButton uiLocale={uiLocale} />
          </div>
        </div>

        {locked ? (
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {t(uiLocale, "settings.roles.detail.locked")}
            </p>
          </div>
        ) : null}

        <div className="space-y-4 px-4 py-4">
          <div className="hidden overflow-x-auto sm:block">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left">
                    {localizeText(uiLocale, "โมดูล", "ໂມດູນ", "Module")}
                  </th>
                  {actionColumns.map((action) => (
                    <th key={action} className="px-3 py-2 text-center uppercase">
                      {actionLabelMap[action]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resources.map((resource) => (
                  <tr key={resource} className="border-t border-slate-100">
                    <td className="sticky left-0 z-10 bg-white px-3 py-3 font-medium text-slate-900">
                      {moduleLabelMap[resource as keyof typeof moduleLabelMap] ?? resource}
                    </td>
                    {actionColumns.map((action) => {
                      const permissionKey = `${resource}.${action}`;
                      const permissionExists = permissionMap.has(permissionKey);

                      if (!permissionExists) {
                        return (
                          <td key={permissionKey} className="px-3 py-3 text-center text-slate-300">
                            -
                          </td>
                        );
                      }

                      return (
                        <td key={permissionKey} className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedKeys.has(permissionKey)}
                            onChange={() => togglePermission(permissionKey)}
                            disabled={locked || !canManage || saving}
                            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 sm:hidden">
            {resources.map((resource) => (
              <section
                key={resource}
                className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3"
              >
                <h2 className="text-sm font-semibold text-slate-900">
                  {moduleLabelMap[resource as keyof typeof moduleLabelMap] ?? resource}
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {actionColumns.map((action) => {
                    const permissionKey = `${resource}.${action}`;
                    const permissionExists = permissionMap.has(permissionKey);

                    if (!permissionExists) {
                      return (
                        <div
                          key={permissionKey}
                          className="flex h-10 items-center justify-between rounded-xl border border-slate-100 bg-white px-3 text-xs text-slate-400"
                        >
                          <span>{actionLabelMap[action]}</span>
                          <span>-</span>
                        </div>
                      );
                    }

                    return (
                      <label
                        key={permissionKey}
                        className="flex h-10 items-center justify-between rounded-xl border border-slate-200 bg-white px-3"
                      >
                        <span className="text-xs font-medium text-slate-700">{actionLabelMap[action]}</span>
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(permissionKey)}
                          onChange={() => togglePermission(permissionKey)}
                          disabled={locked || !canManage || saving}
                          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                        />
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-100 px-4 py-4">
          {errorMessage ? (
            <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {errorMessage}
            </p>
          ) : null}

          <div ref={saveSectionRef} className="sm:sticky sm:bottom-3 sm:z-10">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:bg-white/95 sm:shadow-lg sm:backdrop-blur">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-slate-500">
                  {t(uiLocale, "settings.roles.detail.selection.prefix")}{" "}
                  {selectedKeys.size.toLocaleString(numberLocale)}{" "}
                  {t(uiLocale, "settings.roles.detail.selection.suffix")}
                </div>
                <Button
                  className="h-11 w-full rounded-full sm:w-auto sm:min-w-[190px]"
                  onClick={onSave}
                  disabled={locked || !canManage || saving || !hasUnsavedChanges}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t(uiLocale, "settings.roles.detail.action.saving")}
                    </>
                  ) : (
                    t(uiLocale, "settings.roles.detail.action.save")
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </article>

      {showFloatingScrollButton ? (
        <Button
          type="button"
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] right-4 z-30 h-10 rounded-full px-4 shadow-lg sm:bottom-6"
          onClick={scrollToSave}
        >
          {t(uiLocale, "settings.roles.detail.action.scrollToSave")}
        </Button>
      ) : null}
    </section>
  );
}
