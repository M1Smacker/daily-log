// Small shared pieces for the screens: formatting, icons, the sheet, and the
// tables that buttons and forms look their handlers up in.

import { typedNumber } from './rules.js';

export const view = document.getElementById('view');
export const sheet = document.getElementById('sheet');

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const num = (n) => Math.round(n).toLocaleString('en-GB');
export const pct = (part, whole) => (whole > 0 ? Math.min(100, Math.max(0, (part / whole) * 100)) : 0).toFixed(1);
export const fmt = (key, opts) =>
  new Date(key + 'T00:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts });
export const shortDate = (key) => fmt(key, { day: 'numeric', month: 'short' });
export const longDate = (key) => fmt(key, { weekday: 'long', day: 'numeric', month: 'long' });
export const litres = (ml) => (ml / 1000).toLocaleString('en-GB', { maximumFractionDigits: 2 });
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const icon = (size, paths) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
export const TICK = icon(18, '<path d="M5 12.5l4.5 4.5L19 7.5"/>');
export const SETTINGS = icon(20, '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>');
export const CHEVRON_RIGHT = icon(14, '<path d="M9 6l6 6-6 6"/>');
export const BACK = icon(20, '<path d="M15 6l-6 6 6 6"/>');
export const CHEVRON = icon(16, '<path d="M6 9l6 6 6-6"/>');

// Buttons carry data-act="name", forms carry data-form="name". Screens add their handlers here.
export const actions = {};
export const forms = {};
// Set by app.js. Screens call it after changing something that is not stored (an open panel, a picked food).
export const app = { redraw: () => {} };

// The sheet slides up when it opens and back down when it closes. CLOSE_MS matches sheet-down in the CSS.
const CLOSE_MS = 240;
let closing = null; // finishes the close that is playing now

export function openSheet(html) {
  // A close still playing (a form that saves, then opens the next sheet): finish it now, so the
  // new sheet comes up fresh and is not shut by the old one's ending.
  closing?.();
  sheet.innerHTML = html;
  if (!sheet.open) sheet.showModal();
}
export function closeSheet() {
  if (!sheet.open || closing) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return sheet.close();
  const timer = setTimeout(() => closing?.(), CLOSE_MS);
  closing = () => {
    clearTimeout(timer);
    closing = null;
    sheet.classList.remove('closing');
    sheet.close();
  };
  sheet.classList.add('closing');
}
actions['close-sheet'] = closeSheet;
// The Escape key, on a computer, closes it the same way.
sheet.addEventListener('cancel', (e) => { e.preventDefault(); closeSheet(); });

// The fill of a progress bar. Screens are redrawn whole, so each bar's last position is kept
// here: the new fill starts from where the old one stood and glides to its new place.
const barAt = new Map();
export function fill(id, part, whole) {
  const now = pct(part, whole);
  const was = barAt.get(id) ?? now;
  barAt.set(id, now);
  return `<i style="--from:${was}%;--to:${now}%"></i>`;
}

// A labelled number field. Decimal keypad on phones, 16 px text so Safari does not zoom.
export const field = (name, label, value, { unit = '', decimal = true, required = true, hint = '' } = {}) => `
  <label class="field">
    <span>${label}${unit ? ` <i>${unit}</i>` : ''}</span>
    <input name="${name}" type="text" inputmode="${decimal ? 'decimal' : 'numeric'}" autocomplete="off"
      value="${esc(value ?? '')}" ${required ? 'required' : ''} pattern="[0-9]*[.,]?[0-9]*">
    ${hint ? `<small>${hint}</small>` : ''}
  </label>`;

// Reads a number typed with a dot or a comma. Returns null when empty or not a number.
export const readNumber = (formData, name) => typedNumber(formData.get(name));
