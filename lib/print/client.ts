const DEFAULT_PRINT_IMAGE_TIMEOUT_MS = 2000;

export async function waitForImagesBeforePrint(
  scope: ParentNode,
  timeoutMs = DEFAULT_PRINT_IMAGE_TIMEOUT_MS,
) {
  const images = Array.from(scope.querySelectorAll("img"));
  if (images.length === 0) {
    return;
  }

  const waitForSingleImage = (image: HTMLImageElement) =>
    new Promise<void>((resolve) => {
      if (image.complete && image.naturalWidth > 0) {
        resolve();
        return;
      }

      const cleanup = () => {
        image.removeEventListener("load", handleDone);
        image.removeEventListener("error", handleDone);
      };

      const handleDone = () => {
        cleanup();
        resolve();
      };

      image.addEventListener("load", handleDone, { once: true });
      image.addEventListener("error", handleDone, { once: true });
    });

  await Promise.race([
    Promise.all(images.map((image) => waitForSingleImage(image))).then(() => undefined),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, timeoutMs);
    }),
  ]);
}

export async function fetchImageAsDataUrl(sourceUrl: string) {
  const response = await fetch(sourceUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("PRINT_IMAGE_FETCH_FAILED");
  }

  const blob = await response.blob();

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("PRINT_IMAGE_READ_FAILED"));
    };
    reader.onerror = () => {
      reject(new Error("PRINT_IMAGE_READ_FAILED"));
    };
    reader.readAsDataURL(blob);
  });
}
