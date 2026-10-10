import { useId, useState, type ComponentType, type ReactNode } from 'react';
import type { A2UIComponent, A2UIScreen, MayaAction } from '../core/types.js';
import { isRecord } from '../core/protocol.js';

export interface ComponentRendererProps {
  component: A2UIComponent;
  onAction: (action: MayaAction) => void;
  loading: boolean;
  children?: ReactNode;
}
export interface A2UIRendererProps {
  screen: A2UIScreen;
  onAction: (action: MayaAction) => void;
  loading?: boolean;
  components?: Record<string, ComponentType<ComponentRendererProps>>;
}
const text = (value: unknown): string => value === null || value === undefined ? '' :
  typeof value === 'object' ? JSON.stringify(value) : String(value);
const number = (value: unknown, fallback = 0): number => Number.isFinite(Number(value)) ? Number(value) : fallback;
const entries = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.filter(isRecord) : [];
const payload = (value: unknown): Record<string, unknown> => isRecord(value) ? value : {};
const icons: Record<string, string> = { sparkles: '✦', target: '◎', calendar: '▦',
  'check-circle': '✓', 'alert-triangle': '⚠', 'chart-bar': '▥', 'chart-pie': '◕',
  'trending-up': '↗', 'trending-down': '↘', home: '⌂', zap: 'ϟ' };

function InputControl({ component, onAction, loading }: ComponentRendererProps) {
  const p = component.props;
  const inputId = useId();
  const isSlider = component.type === 'SliderInput';
  const [value, setValue] = useState(text(p.defaultValue ?? (isSlider ? p.min ?? 0 : '')));
  return <form className="maya-input" onSubmit={event => {
    event.preventDefault();
    onAction({ type: text(p.actionType), componentId: component.id,
      payload: { ...payload(p.payload), name: text(p.name || component.id), value: isSlider ? number(value) : value } });
  }}>
    <label htmlFor={inputId}>{text(p.label)}</label>
    {component.type === 'SelectInput'
      ? <select id={inputId} value={value} onChange={event => setValue(event.target.value)} disabled={loading}>
          <option value="">Selecciona una opción</option>
          {entries(p.options).map((option, i) => <option key={i} value={text(option.value)}>{text(option.label)}</option>)}
        </select>
      : <input id={inputId} type={isSlider ? 'range' : 'text'} value={value}
          onChange={event => setValue(event.target.value)} placeholder={text(p.placeholder)} disabled={loading}
          min={isSlider ? number(p.min) : undefined} max={isSlider ? number(p.max, 100) : undefined}
          step={isSlider ? number(p.step, 1) : undefined} />}
    {isSlider && <output htmlFor={inputId}>{value} {text(p.unit)}</output>}
    <button type="submit" disabled={loading}>{text(p.buttonLabel || 'Actualizar')}</button>
  </form>;
}

export function A2UIRenderer({ screen, onAction, loading = false, components = {} }: A2UIRendererProps) {
  function render(c: A2UIComponent): ReactNode {
    const p = c.props;
    const children = c.children?.map(render);
    const Custom = components[c.type];
    if (Custom) return <Custom key={c.id} component={c} loading={loading} onAction={onAction}>{children}</Custom>;
    const title = p.title ? <h3>{text(p.title)}</h3> : null;
    const button = (entry: Record<string, unknown>, key: string) => <button key={key} type="button"
      disabled={loading} data-variant={text(entry.variant)} aria-pressed={typeof entry.selected === 'boolean' ? entry.selected : undefined}
      onClick={() => onAction({ type: text(entry.actionType), payload: payload(entry.payload), componentId: c.id })}>
        {text(entry.label)}
      </button>;
    switch (c.type) {
      case 'Section': case 'Card': return <section key={c.id} className="maya-card" data-variant={text(p.variant)}>
        {title}{p.subtitle ? <p className="maya-muted">{text(p.subtitle)}</p> : null}{children}</section>;
      case 'Grid': return <div key={c.id} className="maya-grid" style={{ gridTemplateColumns:
        `repeat(${Math.max(1, Math.trunc(number(p.columns, 2)))}, minmax(0, 1fr))` }}>{children}</div>;
      case 'Stack': return <div key={c.id} className="maya-stack" data-direction={text(p.direction)}
        data-gap={text(p.gap)}>{children}</div>;
      case 'Divider': return <hr key={c.id} />;
      case 'SectionHeader': case 'HeaderBadge': return <header key={c.id} className="maya-section-header">
        {p.icon ? <span aria-hidden="true">{icons[text(p.icon)] ?? '✦'}</span> : null}
        <div>{p.tag ? <small>{text(p.tag)}</small> : null}{title}
          {p.subtitle ? <p className="maya-muted">{text(p.subtitle)}</p> : null}</div></header>;
      case 'Text': return <p key={c.id} className="maya-text" data-size={text(p.size)} data-color={text(p.color)}
        style={{ fontWeight: p.bold ? 700 : undefined }}>{text(p.content ?? p.text)}</p>;
      case 'Icon': return <span key={c.id} className="maya-icon" aria-label={text(p.name)}>{icons[text(p.name)] ?? '✦'}</span>;
      case 'AlertBanner': return <div key={c.id} className="maya-alert" role="status" data-variant={text(p.variant)}>{text(p.message)}</div>;
      case 'StatTile': case 'MetricItem': return <div key={c.id} className="maya-stat" data-tone={text(p.tone)}>
        {p.icon ? <span aria-hidden="true">{icons[text(p.icon)] ?? '✦'}</span> : null}
        <span className="maya-muted">{text(p.label)}</span><strong>{text(p.value)}</strong>
        {p.subtext ? <small>{text(p.subtext)}</small> : null}
        {p.trend ? <span aria-label={text(p.trend)}>{p.trend === 'positive' ? '↗' : '↘'}</span> : null}</div>;
      case 'MetricGrid': return <div key={c.id} className="maya-grid">
        {entries(p.items).map((item, i) => <div className="maya-stat" key={i}><span>{text(item.label)}</span>
          <strong>{text(item.value)}</strong><small>{text(item.subtext)}</small></div>)}</div>;
      case 'ProgressBar': {
        const max = Math.max(1, number(p.max, 100));
        const value = Math.max(0, Math.min(max, number(p.value)));
        return <div key={c.id} className="maya-progress"><span>{text(p.label)} · {text(p.value)} {text(p.unit)}</span>
          <progress aria-label={text(p.label)} value={value} max={max} />
          {p.subtext ? <small>{text(p.subtext)}</small> : null}</div>;
      }
      case 'BarChart': {
        const bars = entries(p.bars);
        const max = Math.max(1, ...bars.map(bar => number(bar.value)));
        return <figure key={c.id} className="maya-chart">{title}
          {bars.map((bar, i) => <div key={i} className="maya-bar-row"><span>{text(bar.label)}</span>
            <span>{text(bar.value)} {text(p.unit)}</span><div className="maya-bar-track"><div style={{
              width: `${Math.max(0, number(bar.value) / max * 100)}%`, background: text(bar.color) || 'var(--maya-primary)' }} /></div></div>)}</figure>;
      }
      case 'DonutChart': {
        const segments = entries(p.segments);
        const total = segments.reduce((sum, s) => sum + Math.max(0, number(s.value)), 0);
        const colors = ['var(--maya-primary)', '#818cf8', '#38bdf8', '#94a3b8', '#c4b5fd'];
        let offset = 0;
        return <figure key={c.id} className="maya-chart">{title}<div className="maya-donut-row">
          <div className="maya-donut"><svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="12" />
            {segments.map((s, i) => {
              const len = Math.max(0, number(s.value)) / (total || 1) * 251.327;
              const circle = <circle key={i} cx="50" cy="50" r="40" fill="none" stroke={text(s.color) || colors[i % colors.length]}
                strokeWidth="12" strokeDasharray={`${len} ${251.327 - len}`} strokeDashoffset={-offset} />;
              offset += len;
              return circle;
            })}</svg><div><small>{text(p.centerLabel)}</small><strong>{text(p.centerValue ?? total)}</strong></div></div>
          <ul>{segments.map((s, i) => <li key={i}><span style={{ color: text(s.color) || colors[i % colors.length] }}>● </span>
            {text(s.label)}: {text(s.value)} {text(p.unit)}</li>)}</ul></div></figure>;
      }
      case 'ActionButton': return button(p, c.id);
      case 'OptionPills': case 'ActionList': return <div key={c.id} className="maya-actions">{title}
        {p.label ? <span>{text(p.label)}</span> : null}
        {entries(p[c.type === 'OptionPills' ? 'options' : 'actions']).map((entry, i) => button(entry, `${c.id}_${i}`))}</div>;
      case 'TextInput': case 'SelectInput': case 'SliderInput': return <InputControl key={c.id} component={c} onAction={onAction} loading={loading} />;
      case 'QuickSuggestions': return <div key={c.id} className="maya-actions">
        {(Array.isArray(p.prompts) ? p.prompts : []).map((prompt, i) => button({ label: text(prompt),
          actionType: 'USER_PROMPT', payload: { text: text(prompt) } }, `${c.id}_${i}`))}</div>;
      default: return <div key={c.id} className="maya-alert" role="alert">Componente sin renderizador: {c.type}</div>;
    }
  }
  return <div className="maya-ui" aria-busy={loading}>{screen.components.map(render)}</div>;
}
