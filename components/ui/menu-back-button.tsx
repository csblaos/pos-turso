"use client";

import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { clearNewOrderDraftState, hasNewOrderDraftFlag } from "@/lib/orders/new-order-draft";
import { cn } from "@/lib/utils";

type MenuBackButtonProps = {
  roots: string[];
  className?: string;
  label?: string;
  showLabelOnMobile?: boolean;
  keepSpaceWhenHidden?: boolean;
  backHref?: string;
};

const isInRoot = (pathname: string, root: string) =>
  pathname === root || pathname.startsWith(`${root}/`);

export function MenuBackButton({
  roots,
  className,
  label = "ย้อนกลับ",
  showLabelOnMobile = false,
  keepSpaceWhenHidden = false,
  backHref,
}: MenuBackButtonProps) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const activeRoot = useMemo(() => {
    const sortedRoots = [...roots].sort((a, b) => b.length - a.length);
    return sortedRoots.find((root) => isInRoot(pathname, root)) ?? null;
  }, [pathname, roots]);

  const targetHref = backHref ?? activeRoot;

  useEffect(() => {
    if (!targetHref) {
      return;
    }

    router.prefetch(targetHref);
  }, [router, targetHref]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!showDiscardDialog) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowDiscardDialog(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showDiscardDialog]);

  if (!targetHref || pathname === targetHref) {
    if (keepSpaceWhenHidden) {
      return <span aria-hidden className={cn("inline-flex h-9 w-20", className)} />;
    }
    return null;
  }

  const handleNavigate = () => {
    const isCreateOrderPath =
      pathname === "/orders/new" || pathname.startsWith("/orders/new/");
    if (isCreateOrderPath && hasNewOrderDraftFlag()) {
      setShowDiscardDialog(true);
      return;
    }
    router.push(targetHref);
  };

  const confirmNavigateWithDiscard = () => {
    clearNewOrderDraftState();
    setShowDiscardDialog(false);
    router.push(targetHref);
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          showLabelOnMobile
            ? "h-9 min-w-9 gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 text-slate-700 shadow-sm transition-colors hover:bg-slate-50 active:scale-[0.98]"
            : "h-9 w-9 rounded-full border border-slate-200 bg-white p-0 text-slate-700 shadow-sm transition-colors hover:bg-slate-50 active:scale-[0.98] sm:h-9 sm:w-auto sm:min-w-9 sm:gap-1.5 sm:px-2.5",
          className,
        )}
        onMouseEnter={() => router.prefetch(targetHref)}
        onTouchStart={() => router.prefetch(targetHref)}
        onClick={handleNavigate}
      >
        <ArrowLeft className="h-4 w-4" />
        {showLabelOnMobile ? (
          <span className="text-xs font-semibold">{label}</span>
        ) : (
          <>
            <span className="hidden text-xs font-semibold sm:inline">{label}</span>
            <span className="sr-only sm:hidden">{label}</span>
          </>
        )}
      </Button>

      {isClient && showDiscardDialog
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 px-4"
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  setShowDiscardDialog(false);
                }
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="leave-order-dialog-title"
                className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
              >
                <h3 id="leave-order-dialog-title" className="text-sm font-semibold text-slate-900">
                  ออกจากหน้าสร้างออเดอร์?
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  มีข้อมูลออเดอร์ที่ยังไม่บันทึก หากออกตอนนี้ข้อมูลที่กรอกไว้จะหายไป
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9"
                    onClick={() => setShowDiscardDialog(false)}
                  >
                    กลับไปแก้ไข
                  </Button>
                  <Button type="button" className="h-9" onClick={confirmNavigateWithDiscard}>
                    ออกจากหน้านี้
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
