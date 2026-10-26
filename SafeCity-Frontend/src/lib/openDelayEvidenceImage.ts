/** Open the original black-background, full-image evidence preview safely.
 * DOM nodes are created directly rather than concatenating untrusted HTML.
 * CSS properties are applied via the browser style API (CSP compatible).
 * Call only from user gestures so the new tab is not blocked as a popup.
 */
export function openDelayEvidenceImage(imageUrl: string | null | undefined): void {
  if (!imageUrl) return;
  const preview = window.open("", "_blank");
  if (!preview) return;

  const doc = preview.document;
  doc.title = "Delay Evidence";
  const body = doc.body;
  body.style.margin = "0";
  body.style.display = "flex";
  body.style.justifyContent = "center";
  body.style.alignItems = "center";
  body.style.minHeight = "100vh";
  body.style.background = "#000";

  const image = doc.createElement("img");
  image.src = imageUrl;
  image.alt = "Delay Evidence";
  image.style.maxWidth = "100%";
  image.style.maxHeight = "100vh";
  image.style.objectFit = "contain";
  body.replaceChildren(image);
}
