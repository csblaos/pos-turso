import { BarcodeFormat, EncodeHintType, QRCodeWriter } from "@zxing/library";

const escapeHtmlAttribute = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

type QrSvgOptions = {
  size?: number;
  margin?: number;
  foreground?: string;
  background?: string;
  ariaLabel?: string;
  className?: string;
};

export function buildOrderQrPayload(orderNo: string) {
  return `ORDER:${orderNo}`;
}

export function parseOrderSearchValue(rawValue: string) {
  const value = rawValue.trim();
  if (!value) {
    return "";
  }
  if (value.toUpperCase().startsWith("ORDER:")) {
    return value.slice("ORDER:".length).trim();
  }
  return value;
}

export function buildQrSvgMarkup(
  value: string,
  {
    size = 132,
    margin = 0,
    foreground = "#0f172a",
    background = "#ffffff",
    ariaLabel = "QR code",
    className,
  }: QrSvgOptions = {},
) {
  const writer = new QRCodeWriter();
  const hints = new Map([[EncodeHintType.MARGIN, margin]]);
  const matrix = writer.encode(value, BarcodeFormat.QR_CODE, size, size, hints);
  const width = matrix.getWidth();
  const height = matrix.getHeight();

  let path = "";
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (matrix.get(x, y)) {
        path += `M${x} ${y}h1v1H${x}z`;
      }
    }
  }

  const classAttribute = className ? ` class="${escapeHtmlAttribute(className)}"` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${size}" height="${size}" role="img" aria-label="${escapeHtmlAttribute(
    ariaLabel,
  )}" shape-rendering="crispEdges"${classAttribute}><rect width="100%" height="100%" fill="${escapeHtmlAttribute(
    background,
  )}"/><path fill="${escapeHtmlAttribute(foreground)}" d="${path}"/></svg>`;
}

export function buildOrderQrSvgMarkup(orderNo: string, options?: QrSvgOptions) {
  return buildQrSvgMarkup(buildOrderQrPayload(orderNo), options);
}
