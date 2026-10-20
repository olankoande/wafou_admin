import { useCallback, useEffect, useState } from 'react';
import { Title, useLocaleState, useTranslate } from 'react-admin';
import { Link } from 'react-router-dom';
import { Alert, Box, Button, Card, CircularProgress, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import PeopleOutline from '@mui/icons-material/PeopleOutline';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import CleaningServicesOutlined from '@mui/icons-material/CleaningServicesOutlined';
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import { supabase } from './supabase';
import { money, Status } from './components';
import { formatDate } from './formatDate';

interface Overview {
  profiles?: number; providers?: number; services?: number; requests?: number; bookings?: number; missions?: number; payments?: number; disputes?: number;
  generated_at: string;
  booking_statuses?: { status: string; count: number }[];
  finance?: { currency: string; captured_minor: string; refunded_minor: string }[];
  recent_requests?: { id: string; client: string; service: string; status: string; requested_start: string|null }[];
}

export function Dashboard() {
  const t = useTranslate();
  const [locale] = useLocaleState();
  const [data, setData] = useState<Overview>();
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const result = await supabase.rpc('admin_dashboard');
      if (result.error) setError(true); else setData(result.data as Overview);
    } catch { setError(true); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const metrics = [
    { field: 'requests', resource: 'service_requests', icon: ReceiptLongOutlined, tint: '#edf1ff', color: '#5c6ab8' },
    { field: 'bookings', resource: 'bookings', icon: CalendarMonthOutlined, tint: '#fff1df', color: '#b87820' },
    { field: 'providers', resource: 'provider_profiles', icon: CleaningServicesOutlined, tint: '#e7f4ee', color: '#3a8465' },
    { field: 'profiles', resource: 'profiles', icon: PeopleOutline, tint: '#e8f0f6', color: '#477696' },
  ] as const;
  const totalBookings = data?.booking_statuses?.reduce((sum, row) => sum + row.count, 0) ?? 0;
  return <Box component="main" sx={{ maxWidth: 1440, mx: 'auto', pb: 3 }}>
    <Title title={t('app.overview')} />
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2} sx={{ mb: 3.5, mt: 1 }}>
      <Box><Typography variant="overline" sx={{ color: '#7c8b96', letterSpacing: 1.8, fontSize: 10 }}>WAFOU / {t('app.overview')}</Typography><Typography component="h1" variant="h4" sx={{ fontWeight: 700, letterSpacing: -1, mt: .5 }}>{t('app.welcome')}</Typography><Typography color="text.secondary" sx={{ mt: 1, fontSize: 13 }}>{t('app.subtitle')}</Typography></Box>
      <Button onClick={() => void load()} disabled={loading} variant="outlined" startIcon={<RefreshRounded />} sx={{ mt: 1, bgcolor: 'white', flexShrink: 0 }}>{t('app.refresh')}</Button>
    </Stack>
    {error && <Alert severity="error" sx={{ mb: 3 }} action={<Button onClick={() => void load()}>{t('app.refresh')}</Button>}>{t('app.errors.requestFailed')}</Alert>}
    {loading && !data && <Box role="status" sx={{ py: 8, textAlign: 'center' }}><CircularProgress /></Box>}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4,1fr)' }, gap: 2, mb: 3 }}>
      {metrics.map(({ field, resource, icon: Icon, tint, color }) => data?.[field] !== undefined && <Card key={field} component={Link} to={`/${resource}`} sx={{ p: 2.5, textDecoration: 'none', color: 'inherit', transition: 'border-color 150ms', '&:hover': { borderColor: '#a3b9c3' } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="body2" color="text.secondary">{t(`resources.${resource}.name`)}</Typography><Box sx={{ width: 38, height: 38, bgcolor: tint, color, borderRadius: 2, display: 'grid', placeItems: 'center' }}><Icon fontSize="small" /></Box></Stack>
        <Typography sx={{ fontSize: 35, lineHeight: 1.3, fontWeight: 750, letterSpacing: -1.3, my: 1 }}>{data[field]}</Typography><Stack direction="row" alignItems="center" gap={.5}><Typography variant="caption" color="text.secondary">{t('app.details')}</Typography><ArrowForwardRounded sx={{ fontSize: 13, color: '#8a9ba6' }} /></Stack>
      </Card>)}
    </Box>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,1.55fr) minmax(0,1fr)' }, gap: 3 }}>
      <Card sx={{ overflow: 'hidden' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2.5 }}><Typography variant="h6">{t('app.activity')}</Typography>{data?.recent_requests && <Button component={Link} to="/service_requests" size="small" endIcon={<ArrowForwardRounded />}>{t('resources.service_requests.name')}</Button>}</Stack>
        <Divider />
        <Box sx={{ overflowX: 'auto' }}><Table size="small"><TableHead><TableRow><TableCell>{t('app.fields.client_id')}</TableCell><TableCell>{t('app.fields.service_id')}</TableCell><TableCell>{t('app.fields.status')}</TableCell></TableRow></TableHead>
          <TableBody>{data?.recent_requests?.map(row => <TableRow key={row.id} hover><TableCell><Typography variant="body2" sx={{ fontWeight: 650 }}>{row.client}</Typography><Typography variant="caption" color="text.secondary">{formatDate(row.requested_start,locale)}</Typography></TableCell><TableCell><Link className="record-link" to={`/service_requests/${row.id}/show`}>{row.service}</Link></TableCell><TableCell><Status value={row.status} /></TableCell></TableRow>)}</TableBody></Table></Box>
        {!data?.recent_requests?.length && <Typography sx={{ p: 4 }} color="text.secondary">{t('app.noActivity')}</Typography>}
      </Card>
      <Stack gap={3}>
        {data?.booking_statuses && <Card sx={{ p: 3 }}><Typography variant="h6" sx={{ mb: 2.5 }}>{t('app.bookingStatus')}</Typography>{data.booking_statuses.map((row, i) => <Box key={row.status} sx={{ mb: 2 }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}><Status value={row.status} /><Typography variant="body2" sx={{ fontWeight: 700 }}>{row.count}</Typography></Stack><Box role="img" aria-label={`${t(`app.states.${row.status}`, { _: row.status })}: ${row.count}`} sx={{ bgcolor: '#eef1f3', height: 6, borderRadius: 4, overflow: 'hidden' }}><Box sx={{ bgcolor: ['#4c8c77', '#dda454', '#8398af'][i % 3], width: `${totalBookings ? row.count / totalBookings * 100 : 0}%`, height: '100%', borderRadius: 4 }} /></Box></Box>)}</Card>}
        {data?.finance && <Card sx={{ p: 3 }}><Typography variant="h6" sx={{ mb: 2.5 }}>{t('app.finance')}</Typography>{data.finance.map(row => <Box key={row.currency}><Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}><Typography variant="body2" color="text.secondary">{t('app.captured')}</Typography><Typography variant="body2" fontWeight={700}>{money(row.captured_minor, row.currency, locale)}</Typography></Stack><Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">{t('app.refunded')}</Typography><Typography variant="body2">{money(row.refunded_minor, row.currency, locale)}</Typography></Stack></Box>)}<Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>{t('app.financeNote')}</Typography></Card>}
      </Stack>
    </Box>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>{t('app.demo')}</Typography>
  </Box>;
}
