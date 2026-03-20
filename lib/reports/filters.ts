export const REPORT_DATE_PRESETS = [
  "TODAY",
  "LAST_7_DAYS",
  "LAST_30_DAYS",
  "THIS_MONTH",
  "LAST_MONTH",
  "CUSTOM",
] as const;

export type ReportDatePreset = (typeof REPORT_DATE_PRESETS)[number];

export const REPORT_CHANNEL_FILTERS = ["ALL", "WALK_IN", "FACEBOOK", "WHATSAPP"] as const;

export type ReportChannelFilter = (typeof REPORT_CHANNEL_FILTERS)[number];

export type ReportsFilterState = {
  preset: ReportDatePreset;
  dateFrom: string;
  dateTo: string;
  channel: ReportChannelFilter;
};

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getDateRangeForPreset(
  preset: ReportDatePreset,
  now = new Date(),
): { dateFrom: string; dateTo: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (preset === "TODAY") {
    const iso = toDateInputValue(today);
    return { dateFrom: iso, dateTo: iso };
  }

  if (preset === "LAST_7_DAYS") {
    return {
      dateFrom: toDateInputValue(addDays(today, -6)),
      dateTo: toDateInputValue(today),
    };
  }

  if (preset === "LAST_30_DAYS") {
    return {
      dateFrom: toDateInputValue(addDays(today, -29)),
      dateTo: toDateInputValue(today),
    };
  }

  if (preset === "THIS_MONTH") {
    return {
      dateFrom: toDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1)),
      dateTo: toDateInputValue(today),
    };
  }

  if (preset === "LAST_MONTH") {
    const monthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    return {
      dateFrom: toDateInputValue(monthStart),
      dateTo: toDateInputValue(monthEnd),
    };
  }

  const iso = toDateInputValue(today);
  return { dateFrom: iso, dateTo: iso };
}

export function resolveReportsFilterState(input: {
  preset?: string | string[];
  dateFrom?: string | string[];
  dateTo?: string | string[];
  channel?: string | string[];
}): ReportsFilterState {
  const presetValue = Array.isArray(input.preset) ? input.preset[0] : input.preset;
  const requestedPreset = REPORT_DATE_PRESETS.includes(presetValue as ReportDatePreset)
    ? (presetValue as ReportDatePreset)
    : "LAST_7_DAYS";
  const channelValue = Array.isArray(input.channel) ? input.channel[0] : input.channel;
  const channel = REPORT_CHANNEL_FILTERS.includes(channelValue as ReportChannelFilter)
    ? (channelValue as ReportChannelFilter)
    : "ALL";

  if (requestedPreset === "CUSTOM") {
    const dateFromInput = Array.isArray(input.dateFrom) ? input.dateFrom[0] : input.dateFrom ?? "";
    const dateToInput = Array.isArray(input.dateTo) ? input.dateTo[0] : input.dateTo ?? "";
    const fallback = getDateRangeForPreset("LAST_7_DAYS");
    const dateFrom = isValidIsoDate(dateFromInput) ? dateFromInput : fallback.dateFrom;
    const dateTo = isValidIsoDate(dateToInput) ? dateToInput : fallback.dateTo;
    if (dateFrom <= dateTo) {
      return { preset: "CUSTOM", dateFrom, dateTo, channel };
    }
    return { preset: "CUSTOM", dateFrom: dateTo, dateTo: dateFrom, channel };
  }

  const range = getDateRangeForPreset(requestedPreset);
  return {
    preset: requestedPreset,
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    channel,
  };
}
