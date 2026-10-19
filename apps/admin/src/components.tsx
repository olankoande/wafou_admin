import { Chip, Typography, Box, Button, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { useLocaleState, useRecordContext, useTranslate } from 'react-admin';
import { useEffect } from 'react';

export function LanguageSwitch() {
  const [locale, setLocale] = useLocaleState();
  const translate = useTranslate();
  useEffect(() => { document.documentElement.lang = locale; localStorage.setItem('wafou-admin-locale', locale); }, [locale]);
  return <ToggleButtonGroup size="small" exclusive value={locale} aria-label={translate('app.language')}
    onChange={(_, value: string | null) => { if (value) setLocale(value); }}>
    <ToggleButton value="fr">FR</ToggleButton><ToggleButton value="en">EN</ToggleButton>
  </ToggleButtonGroup>;
}

export function Wordmark({ light = false }: { light?: boolean }) {
  return <Typography component="span" sx={{ fontWeight: 900, letterSpacing: '-1.7px', fontSize: 27, color: light ? '#fff' : '#173443' }}>WAFOU<Typography component="span" sx={{ color: '#eb9b42', fontSize: 30 }}>.</Typography></Typography>;
}

export function Status({ value }: { value: unknown }) {
  const t = useTranslate();
  const state = typeof value === 'string' ? value : 'unclassified';
  const positive = ['active', 'completed', 'fulfilled', 'published', 'succeeded', 'accepted', 'resolved'].includes(state);
  const muted = state.startsWith('demo') || state === 'unclassified';
  return <Chip size="small" label={t(`app.states.${state}`, { _: state.replaceAll('_', ' ') })}
    sx={{ fontSize: 11, fontWeight: 650, height: 25, bgcolor: positive ? '#e7f3ec' : muted ? '#eef0f3' : '#fff1dd', color: positive ? '#286747' : muted ? '#5b6673' : '#895b1b', borderRadius: 1.5 }} />;
}

export function money(value: unknown, currency: unknown, locale: string): string {
  const amount = typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value;
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || typeof currency !== 'string') return '—';
  try { return new Intl.NumberFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', { style: 'currency', currency }).format(amount / 100); }
  catch { return '—'; }
}

export function RecordField({ source, detail = false }: { source: string; label?: string; detail?: boolean }) {
  const record = useRecordContext();
  const [locale] = useLocaleState();
  const t = useTranslate();
  const value = record?.[source];
  if (source === 'status' || source.endsWith('_status') || source === 'environment' || source === 'result') return <Status value={value} />;
  if (value === null || value === undefined || value === '') return <Typography variant="body2" color="text.secondary">—</Typography>;
  if (source.endsWith('_minor')) return <Typography variant="body2" sx={{ fontWeight: 650, whiteSpace: 'nowrap' }}>{money(value, record?.currency ?? 'CAD', locale)}</Typography>;
  if (typeof value === 'boolean') return <Chip size="small" label={t(value ? 'app.yes' : 'app.no')} variant="outlined" />;
  if (typeof value === 'object') return <Box component="pre" sx={{ fontSize: 12, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', bgcolor: '#f5f7f8', p: 2, borderRadius: 2 }}>{JSON.stringify(value, null, 2)}</Box>;
  const text = String(value);
  if (source.endsWith('_at') || source.endsWith('_start') || source.endsWith('_end') || ['starts_at', 'ends_at', 'valid_until'].includes(source)) {
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) return <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>{new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', { dateStyle: 'medium', timeZone: 'America/Toronto' }).format(date)}</Typography>;
  }
  const isId = source === 'id' || source.endsWith('_id');
  return <Typography variant="body2" title={text} sx={{ fontFamily: isId ? 'monospace' : 'inherit', fontSize: isId ? 11 : 13, overflowWrap: 'anywhere', maxWidth: detail ? '100%' : 260 }}>
    {isId && !detail ? `${text.slice(0, 8)}…` : text}
  </Typography>;
}
