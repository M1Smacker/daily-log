// Small shared pieces for the screens: formatting, icons, the sheet, and the
// tables that buttons and forms look their handlers up in.

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

export function openSheet(html) {
  sheet.innerHTML = html;
  if (!sheet.open) sheet.showModal();
}
actions['close-sheet'] = () => sheet.close();

// A labelled number field. Decimal keypad on phones, 16 px text so Safari does not zoom.
export const field = (name, label, value, { unit = '', decimal = true, required = true, hint = '' } = {}) => `
  <label class="field">
    <span>${label}${unit ? ` <i>${unit}</i>` : ''}</span>
    <input name="${name}" type="text" inputmode="${decimal ? 'decimal' : 'numeric'}" autocomplete="off"
      value="${esc(value ?? '')}" ${required ? 'required' : ''} pattern="[0-9]*[.,]?[0-9]*">
    ${hint ? `<small>${hint}</small>` : ''}
  </label>`;

// Reads a number typed with a dot or a comma. Returns null when empty or not a number.
export function readNumber(formData, name) {
  const raw = String(formData.get(name) ?? '').trim().replace(',', '.');
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
