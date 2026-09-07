import type { SensitiveRegion } from "../messaging/types";

const SENSITIVE_SELECTORS: Array<{ selector: string; category: string }> = [
  { selector: 'input[type="password"]', category: "password" },
  { selector: 'input[autocomplete*="cc"]', category: "payment" },
  { selector: 'input[name*="password" i]', category: "password" },
  { selector: 'input[name*="passwd" i]', category: "password" },
  { selector: 'input[name*="card" i]', category: "payment" },
  { selector: 'input[name*="cvv" i]', category: "payment" },
  { selector: 'input[name*="ssn" i]', category: "pii" },
  { selector: "[data-vdlm-sensitive]", category: "custom" },
  { selector: 'iframe[title*="payment" i]', category: "payment" },
];

export function scanSensitiveRegions(): SensitiveRegion[] {
  const regions: SensitiveRegion[] = [];
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  for (const { selector, category } of SENSITIVE_SELECTORS) {
    document.querySelectorAll(selector).forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      if (rect.bottom < 0 || rect.right < 0) return;
      if (rect.top > viewportH || rect.left > viewportW) return;

      regions.push({
        x: rect.left / viewportW,
        y: rect.top / viewportH,
        width: rect.width / viewportW,
        height: rect.height / viewportH,
        category,
      });
    });
  }

  return regions;
}

/** Never extracts text content — geometry only. */
export function getViewportSize(): { width: number; height: number } {
  return { width: window.innerWidth, height: window.innerHeight };
}
