export const SETTINGS_STYLE = `
  .dsh-galaxy-settings { display: flex; flex-direction: column; gap: 20px; padding: 4px 0 32px; }
  .dsh-galaxy-header { display: flex; flex-direction: column; gap: 4px; }
  .dsh-galaxy-header h2 { margin: 0; font-size: 16px; line-height: 24px; font-weight: 600;
    color: var(--dsw-alias-label-primary); }
  .dsh-galaxy-header p { margin: 0; font-size: 13px; line-height: 20px;
    color: var(--dsw-alias-label-secondary); }
  .dsh-galaxy-group { display: flex; flex-direction: column; gap: 2px; }
  .dsh-galaxy-group-title { margin: 0 0 6px; font-size: 12px; line-height: 18px; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase; color: var(--dsw-alias-label-secondary); }
  .dsh-galaxy-card { border: 0.5px solid var(--dsw-alias-border-l1); border-radius: 10px;
    background: var(--dsw-alias-bg-layer-1); overflow: hidden; }
  .dsh-galaxy-row { display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 12px 14px; }
  .dsh-galaxy-row + .dsh-galaxy-row { border-top: 0.5px solid var(--dsw-alias-border-l1); }
  .dsh-galaxy-row-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .dsh-galaxy-row-label { font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-primary); }
  .dsh-galaxy-row-hint { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
  .dsh-galaxy-control { display: flex; align-items: center; gap: 10px; flex: 0 0 auto; }
  .dsh-galaxy-slider { width: 220px; max-width: 38vw; display: flex; align-items: center; gap: 10px; }
  .dsh-galaxy-slider input[type='range'] { flex: 1; min-width: 110px; height: 18px; margin: 0;
    accent-color: var(--dsw-alias-brand-primary); cursor: pointer; }
  .dsh-galaxy-value { min-width: 56px; text-align: right; font-size: 12px; line-height: 18px;
    font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-secondary); }
  .dsh-galaxy-switch { position: relative; width: 38px; height: 22px; padding: 0; flex: none;
    border-radius: 999px; border: 0.5px solid var(--dsw-alias-border-l2);
    background: var(--dsw-alias-bg-layer-2); cursor: pointer; transition: background 120ms ease; }
  .dsh-galaxy-switch[aria-checked='true'] { background: var(--dsw-alias-brand-primary);
    border-color: transparent; }
  .dsh-galaxy-switch:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
  .dsh-galaxy-knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px;
    border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.28);
    transition: transform 140ms ease; }
  .dsh-galaxy-switch[aria-checked='true'] .dsh-galaxy-knob { transform: translateX(16px); }
  .dsh-galaxy-footer { display: flex; justify-content: flex-end; }
  .dsh-galaxy-reset { height: 30px; padding: 0 14px; border-radius: 8px;
    border: 0.5px solid var(--dsw-alias-border-l2); background: transparent; cursor: pointer;
    font-size: 13px; color: var(--dsw-alias-label-primary); }
  .dsh-galaxy-reset:hover { background: var(--dsw-alias-bg-layer-2); }

  /* Shader slider (fire) */
  .dsh-galaxy-fire { width: 240px; max-width: 40vw; display: flex; align-items: center; gap: 10px; }
  .dsh-galaxy-fire-track { position: relative; flex: 1; height: 26px; border-radius: 8px;
    overflow: hidden; isolation: isolate; background: #0b0b10;
    border: 0.5px solid var(--dsw-alias-border-l2); }
  .dsh-galaxy-fire-track canvas { position: absolute; inset: 0; width: 100%; height: 100%;
    pointer-events: none; mix-blend-mode: screen; z-index: 2; }
  .dsh-galaxy-fire-track input[type='range'] { position: absolute; inset: 0; width: 100%;
    height: 100%; margin: 0; padding: 0; background: transparent; appearance: none;
    -webkit-appearance: none; cursor: pointer; z-index: 3; outline: none; }
  .dsh-galaxy-fire-track input[type='range']::-webkit-slider-thumb { -webkit-appearance: none;
    width: 20px; height: 20px; border-radius: 7px;
    background: linear-gradient(170deg, #ffffff 0%, #f0f0f2 40%, #e4e4e6 100%);
    border: 0.5px solid rgba(0, 0, 0, 0.12);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25), 0 3px 8px rgba(0, 0, 0, 0.2),
      inset 0 0.5px 0 rgba(255, 255, 255, 0.85); cursor: grab; }
  .dsh-galaxy-fire-track input[type='range']::-moz-range-thumb { width: 18px; height: 18px;
    border-radius: 6px; background: #f4f4f6; border: 0.5px solid rgba(0, 0, 0, 0.12); cursor: grab; }
  .dsh-galaxy-fire-track:focus-within { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
`;

const STYLE_ID = 'dsh-galaxy-settings-styles';

export function ensureSettingsStyles() {
  let element = document.getElementById(STYLE_ID);
  if (!element) {
    element = document.createElement('style');
    element.id = STYLE_ID;
    element.textContent = SETTINGS_STYLE;
    document.head.appendChild(element);
  }
  return element;
}
