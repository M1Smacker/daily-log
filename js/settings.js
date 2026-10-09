// First-run setup and the Settings screen. Both use the same form for your numbers.

import * as rules from './rules.js';
import * as store from './store.js';
import { ctx } from './state.js';
import { esc, forms, field, readNumber } from './ui.js';

function numbersForm(p, button) {
  const t = p?.targets ?? {};
  return `
    <form class="card" data-form="profile" novalidate>
      <span class="card-title">About you</span>
      <div class="field-grid">
        ${field('heightCm', 'Height', p?.heightCm, { unit: 'cm' })}
        ${field('startKg', 'Starting weight', p?.startKg, { unit: 'kg' })}
        ${field('goalKg', 'Goal weight', p?.goalKg, { unit: 'kg' })}
      </div>
      <div class="rule"></div>
      <div class="eyebrow">Daily targets</div>
      <div class="field-grid">
        ${field('kcal', 'Calories', t.kcal, { unit: 'kcal', decimal: false })}
        ${field('protein', 'Protein', t.protein, { unit: 'g', decimal: false })}
        ${field('carbs', 'Carbs', t.carbs, { unit: 'g', decimal: false })}
        ${field('fat', 'Fat', t.fat, { unit: 'g', decimal: false })}
        ${field('fibre', 'Fibre', t.fibre, { unit: 'g', decimal: false })}
        ${field('waterL', 'Water', t.waterMl ? t.waterMl / 1000 : '', { unit: 'L' })}
      </div>
      <div class="small muted">These stay in your own data. They are never part of the app's public code.</div>
      <div class="form-error" role="alert" hidden></div>
      <button class="btn primary">${button}</button>
    </form>`;
}

export const setupBody = () => `
  <div class="muted" style="font-size:16px">A few numbers to set the app up. You can change any of them later in Settings.</div>
  ${numbersForm(null, 'Start')}`;

export function settingsBody() {
  const c = ctx();
  return `
    ${numbersForm(c.profile, 'Save changes')}
    <form class="card" data-form="rollover" novalidate>
      <span class="card-title">Day rollover</span>
      <label class="field"><span>A new day starts at</span>
        <select name="hour">${[0, 1, 2, 3, 4, 5, 6].map((h) =>
          `<option value="${h}"${h === c.plan.rolloverHour ? ' selected' : ''}>${h === 0 ? 'Midnight' : `${h}:00 am`}</option>`).join('')}</select>
        <small>Anything logged before this counts towards the day before.</small>
      </label>
      <button class="btn">Save</button>
    </form>
    <section class="card">
      <span class="card-title">The plan</span>
      <a class="btn" href="#guide">Open the guide</a>
      <div class="small muted">Face and stomach fat cannot be targeted. Both slim down as overall body fat falls.</div>
      <div class="small muted">Nothing in this app is medical advice. If you feel dizzy, unusually tired or your study focus drops, eat at maintenance for a week and see a doctor.</div>
    </section>`;
}

forms.profile = (fd, form) => {
  const n = (name) => readNumber(fd, name);
  const profile = {
    heightCm: n('heightCm'), startKg: n('startKg'), goalKg: n('goalKg'),
    targets: {
      kcal: n('kcal'), protein: n('protein'), carbs: n('carbs'), fat: n('fat'), fibre: n('fibre'),
      waterMl: n('waterL') === null ? null : Math.round(n('waterL') * 1000),
    },
  };
  const missing = [profile.heightCm, profile.startKg, profile.goalKg, ...Object.values(profile.targets)].some((v) => !v);
  if (missing) return 'Every box needs a number above zero.';

  // Warn once about risky targets, then let a second tap save them anyway.
  const warnings = rules.targetWarnings(profile.targets);
  const seen = warnings.join('|');
  if (warnings.length && form.dataset.warned !== seen) {
    form.dataset.warned = seen;
    form.querySelector('button.primary').textContent = 'Save anyway';
    return warnings.map(esc).join('<br>') + '<br>Tap Save anyway to keep these numbers, or change them.';
  }
  store.setProfile(profile);
  if (location.hash === '#settings') return { done: 'Saved.' };
};

forms.rollover = (fd) => {
  store.setPlan({ rolloverHour: Number(fd.get('hour')) });
  return { done: 'Saved.' };
};
