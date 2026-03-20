import { REPORT_DATE_PRESETS, getDateRangeForPreset, type ReportDatePreset } from "@/lib/reports/filters";

export const CASH_FLOW_DIRECTION_FILTERS = ["ALL", "IN", "OUT"] as const;
export const CASH_FLOW_ENTRY_TYPE_FILTERS = [
  "ALL",
  "SALE_CASH_IN",
  "SALE_QR_IN",
  "SALE_BANK_IN",
  "AR_COLLECTION_IN",
  "COD_SETTLEMENT_IN",
  "PURCHASE_PAYMENT_OUT",
  "PURCHASE_PAYMENT_REVERSAL_IN",
] as const;

export type CashFlowDirectionFilter = (typeof CASH_FLOW_DIRECTION_FILTERS)[number];
export type CashFlowEntryTypeFilter = (typeof CASH_FLOW_ENTRY_TYPE_FILTERS)[number];

export type CashFlowFilterState = {
  preset: ReportDatePreset;
  dateFrom: string;
  dateTo: string;
  direction: CashFlowDirectionFilter;
  entryType: CashFlowEntryTypeFilter;
  account: string;
};

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function resolveCashFlowFilterState(input: {
  preset?: string | string[];
  dateFrom?: string | string[];
  dateTo?: string | string[];
  direction?: string | string[];
  entryType?: string | string[];
  account?: string | string[];
}): CashFlowFilterState {
  const presetValue = Array.isArray(input.preset) ? input.preset[0] : input.preset;
  const requestedPreset = REPORT_DATE_PRESETS.includes(presetValue as ReportDatePreset)
    ? (presetValue as ReportDatePreset)
    : "LAST_7_DAYS";
  const directionValue = Array.isArray(input.direction) ? input.direction[0] : input.direction;
  const direction = CASH_FLOW_DIRECTION_FILTERS.includes(directionValue as CashFlowDirectionFilter)
    ? (directionValue as CashFlowDirectionFilter)
    : "ALL";
  const entryTypeValue = Array.isArray(input.entryType) ? input.entryType[0] : input.entryType;
  const entryType = CASH_FLOW_ENTRY_TYPE_FILTERS.includes(entryTypeValue as CashFlowEntryTypeFilter)
    ? (entryTypeValue as CashFlowEntryTypeFilter)
    : "ALL";
  const accountValue = Array.isArray(input.account) ? input.account[0] : input.account;
  const account = typeof accountValue === "string" && accountValue.trim().length > 0 ? accountValue : "ALL";

  if (requestedPreset === "CUSTOM") {
    const dateFromInput = Array.isArray(input.dateFrom) ? input.dateFrom[0] : input.dateFrom ?? "";
    const dateToInput = Array.isArray(input.dateTo) ? input.dateTo[0] : input.dateTo ?? "";
    const fallback = getDateRangeForPreset("LAST_7_DAYS");
    const dateFrom = isValidIsoDate(dateFromInput) ? dateFromInput : fallback.dateFrom;
    const dateTo = isValidIsoDate(dateToInput) ? dateToInput : fallback.dateTo;
    if (dateFrom <= dateTo) {
      return { preset: "CUSTOM", dateFrom, dateTo, direction, entryType, account };
    }
    return { preset: "CUSTOM", dateFrom: dateTo, dateTo: dateFrom, direction, entryType, account };
  }

  const range = getDateRangeForPreset(requestedPreset);
  return {
    preset: requestedPreset,
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    direction,
    entryType,
    account,
  };
}
