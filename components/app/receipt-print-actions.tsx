"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type ReceiptPrintActionsProps = {
  autoPrint: boolean;
  returnTo: string | null;
  printLabel?: string;
  returnLabel?: string;
};

export function ReceiptPrintActions({
  autoPrint,
  returnTo,
  printLabel = "พิมพ์อีกครั้ง",
  returnLabel = "กลับ POS",
}: ReceiptPrintActionsProps) {
  const router = useRouter();

  useEffect(() => {
    if (!autoPrint) {
      return;
    }

    const timer = window.setTimeout(() => {
      window.print();
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [autoPrint]);

  return (
    <div className="mt-3 flex flex-wrap gap-2 print:hidden">
      <Button type="button" variant="outline" className="h-9 px-3 text-xs" onClick={() => window.print()}>
        {printLabel}
      </Button>
      {returnTo ? (
        <Button
          type="button"
          className="h-9 px-3 text-xs"
          onClick={() => {
            router.push(returnTo);
          }}
        >
          {returnLabel}
        </Button>
      ) : null}
    </div>
  );
}
