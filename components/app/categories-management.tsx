"use client";

import { Info, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { SlideUpSheet } from "@/components/ui/slide-up-sheet";
import { authFetch } from "@/lib/auth/client-token";
import type { UiLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";
import type { CategoryItem } from "@/lib/products/service";

type CategoriesManagementProps = {
  categories: CategoryItem[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  uiLocale: UiLocale;
};

export function CategoriesManagement({
  categories: initialCategories,
  canCreate,
  canUpdate,
  canDelete,
  uiLocale,
}: CategoriesManagementProps) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  /* ── Sheet state ── */
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(
    null,
  );
  const [deleteDialogCategory, setDeleteDialogCategory] =
    useState<CategoryItem | null>(null);

  /* ── Form state ── */
  const [createName, setCreateName] = useState("");
  const [editName, setEditName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(
    null,
  );

  /* ── Sheet open/close ── */
  const openCreateSheet = () => {
    setErrorMessage(null);
    setCreateName("");
    setIsCreateSheetOpen(true);
  };

  const closeCreateSheet = () => {
    if (isSubmitting) return;
    setIsCreateSheetOpen(false);
  };

  const openEditSheet = (cat: CategoryItem) => {
    if (!canUpdate) return;
    setErrorMessage(null);
    setEditingCategory(cat);
    setEditName(cat.name);
    setIsEditSheetOpen(true);
  };

  const closeEditSheet = () => {
    if (isSubmitting) return;
    setIsEditSheetOpen(false);
    setEditingCategory(null);
  };

  const openDeleteDialog = (cat: CategoryItem) => {
    if (!canDelete) return;
    setDeleteErrorMessage(null);
    setDeleteDialogCategory(cat);
  };

  const closeDeleteDialog = () => {
    if (deletingId) return;
    setDeleteDialogCategory(null);
    setDeleteErrorMessage(null);
  };

  /* ── CRUD ── */
  const onCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = createName.trim();
    if (!name || isSubmitting) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const res = await authFetch("/api/products/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data?.message ?? "เพิ่มหมวดหมู่ไม่สำเร็จ");
        return;
      }
      setCategories(data.categories);
      toast.success("เพิ่มหมวดหมู่เรียบร้อย");
      setIsCreateSheetOpen(false);
      router.refresh();
    } catch {
      setErrorMessage("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = editName.trim();
    if (!name || !editingCategory || isSubmitting) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const res = await authFetch("/api/products/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingCategory.id, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data?.message ?? "เปลี่ยนชื่อไม่สำเร็จ");
        return;
      }
      setCategories(data.categories);
      toast.success("เปลี่ยนชื่อเรียบร้อย");
      setIsEditSheetOpen(false);
      setEditingCategory(null);
      router.refresh();
    } catch {
      setErrorMessage("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onConfirmDelete = async () => {
    if (!deleteDialogCategory || !canDelete) return;
    setDeleteErrorMessage(null);
    setDeletingId(deleteDialogCategory.id);
    try {
      const res = await authFetch("/api/products/categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteDialogCategory.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteErrorMessage(data?.message ?? "ลบหมวดหมู่ไม่สำเร็จ");
        return;
      }
      setCategories(data.categories);
      toast.success("ลบหมวดหมู่เรียบร้อย");
      setDeleteDialogCategory(null);
      router.refresh();
    } catch {
      setDeleteErrorMessage("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setDeletingId(null);
    }
  };

  /* ── Style helpers ── */
  const fieldClassName =
    "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none ring-primary focus:ring-2 disabled:bg-slate-100";

  return (
    <section className="space-y-5">
      {/* ── Error banner ── */}
      {errorMessage && !isEditSheetOpen && !deleteDialogCategory ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {errorMessage}
        </p>
      ) : null}

      {/* ── Category list ── */}
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{t(uiLocale, "settings.link.categories.title")}</p>
            <p className="mt-0.5 text-xs text-slate-500">{t(uiLocale, "settings.link.categories.description")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 w-9 rounded-full px-0"
              onClick={() => setIsHelpOpen(true)}
              aria-label={t(uiLocale, "settings.categories.help.ariaLabel")}
            >
              <Info className="h-4 w-4" />
            </Button>
            {canCreate ? (
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-full px-3"
                onClick={openCreateSheet}
              >
                <Plus className="h-4 w-4" />
                เพิ่มหมวดหมู่
              </Button>
            ) : null}
          </div>
        </div>
        {categories.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">
            ยังไม่มีหมวดหมู่สินค้า
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {categories.map((cat) => (
              <li
                key={cat.id}
                className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {cat.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {cat.productCount} สินค้า
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {canUpdate && (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-xl px-3 text-xs"
                      onClick={() => openEditSheet(cat)}
                    >
                      <Pencil className="mr-1 h-3 w-3" />
                      แก้ไข
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-xl border-red-200 px-3 text-xs text-red-600 hover:bg-red-50"
                      onClick={() => openDeleteDialog(cat)}
                      disabled={Boolean(deletingId)}
                    >
                      {deletingId === cat.id ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          กำลังลบ...
                        </>
                      ) : (
                        <>
                          <Trash2 className="mr-1 h-3 w-3" />
                          ลบ
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </article>

      <SlideUpSheet
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        title={t(uiLocale, "settings.categories.help.sheet.title")}
        description={t(uiLocale, "settings.categories.help.sheet.description")}
        panelMaxWidthClass="min-[1200px]:max-w-md"
      >
        <div className="space-y-3 text-sm text-slate-700">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-medium text-slate-900">{t(uiLocale, "settings.categories.help.grouping.title")}</p>
            <p className="mt-1 text-xs text-slate-500">
              {t(uiLocale, "settings.categories.help.grouping.description")}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-medium text-slate-900">{t(uiLocale, "settings.categories.help.renaming.title")}</p>
            <p className="mt-1 text-xs text-slate-500">
              {t(uiLocale, "settings.categories.help.renaming.description")}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-medium text-slate-900">{t(uiLocale, "settings.categories.help.deletion.title")}</p>
            <p className="mt-1 text-xs text-slate-500">
              {t(uiLocale, "settings.categories.help.deletion.description")}
            </p>
          </div>
        </div>
      </SlideUpSheet>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       * SlideUpSheet — Create Category
       * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <SlideUpSheet
        isOpen={isCreateSheetOpen}
        onClose={closeCreateSheet}
        title="เพิ่มหมวดหมู่"
        description="กรอกชื่อหมวดหมู่ที่ต้องการสร้าง"
        panelMaxWidthClass="min-[1200px]:max-w-md"
        disabled={isSubmitting}
      >
        <form className="space-y-3" onSubmit={onCreateSubmit}>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground" htmlFor="create-cat-name">
              ชื่อหมวดหมู่
            </label>
            <input
              id="create-cat-name"
              autoFocus
              className={fieldClassName}
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="เช่น อาหาร, เครื่องดื่ม, ขนม"
              disabled={isSubmitting}
            />
          </div>

          {errorMessage && isCreateSheetOpen ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {errorMessage}
            </p>
          ) : null}

          <Button
            type="submit"
            className="h-11 w-full rounded-xl"
            disabled={!createName.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              "บันทึกหมวดหมู่"
            )}
          </Button>
        </form>
      </SlideUpSheet>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       * SlideUpSheet — Edit Category
       * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <SlideUpSheet
        isOpen={isEditSheetOpen}
        onClose={closeEditSheet}
        title="แก้ไขหมวดหมู่"
        description={
          editingCategory ? `รายการ: ${editingCategory.name}` : "อัปเดตชื่อหมวดหมู่"
        }
        panelMaxWidthClass="min-[1200px]:max-w-md"
        disabled={isSubmitting}
      >
        <form className="space-y-3" onSubmit={onEditSubmit}>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground" htmlFor="edit-cat-name">
              ชื่อหมวดหมู่
            </label>
            <input
              id="edit-cat-name"
              autoFocus
              className={fieldClassName}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {errorMessage && isEditSheetOpen ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {errorMessage}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              onClick={closeEditSheet}
              disabled={isSubmitting}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              className="h-11 rounded-xl"
              disabled={!editName.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                "บันทึกการแก้ไข"
              )}
            </Button>
          </div>
        </form>
      </SlideUpSheet>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       * Delete Confirm Dialog
       * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <SlideUpSheet
        isOpen={Boolean(deleteDialogCategory)}
        onClose={closeDeleteDialog}
        title="ยืนยันการลบหมวดหมู่"
        description={
          deleteDialogCategory
            ? `หมวดหมู่: ${deleteDialogCategory.name}`
            : "เลือกหมวดหมู่ที่ต้องการลบ"
        }
        panelMaxWidthClass="min-[1200px]:max-w-md"
        disabled={Boolean(deletingId)}
      >
        <div className="space-y-3">
          {deleteDialogCategory && deleteDialogCategory.productCount > 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              หมวดหมู่นี้มี{" "}
              <span className="font-semibold">
                {deleteDialogCategory.productCount} สินค้า
              </span>{" "}
              อยู่ — กรุณาย้ายสินค้าออกก่อนจึงจะลบได้
            </p>
          ) : (
            <p className="text-sm text-slate-700">
              คุณต้องการลบหมวดหมู่นี้ใช่หรือไม่?
              การลบไม่สามารถย้อนกลับได้
            </p>
          )}

          {deleteErrorMessage ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {deleteErrorMessage}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              onClick={closeDeleteDialog}
              disabled={Boolean(deletingId)}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              className="h-11 rounded-xl bg-red-600 text-white hover:bg-red-700"
              onClick={onConfirmDelete}
              disabled={
                Boolean(deletingId) ||
                (deleteDialogCategory ? deleteDialogCategory.productCount > 0 : false)
              }
            >
              {deletingId ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  กำลังลบ...
                </>
              ) : (
                "ลบหมวดหมู่"
              )}
            </Button>
          </div>
        </div>
      </SlideUpSheet>
    </section>
  );
}
