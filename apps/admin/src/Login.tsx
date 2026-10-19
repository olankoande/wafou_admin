import { useState, type FormEvent } from 'react';
import { useLogin, useTranslate } from 'react-admin';
import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import { LanguageSwitch, Wordmark } from './components';

export function AdminLogin() {
  const login = useLogin();
  const t = useTranslate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try { await login({ username: email, password }); }
    catch (e) { setError(e instanceof Error && e.message.startsWith('app.') ? e.message : 'app.errors.loginFailed'); }
    finally { setBusy(false); }
  };
  return <Box sx={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, bgcolor: '#fff' }}>
    <Box sx={{ bgcolor: '#173443', color: 'white', p: { md: 7, lg: 10 }, display: { xs: 'none', md: 'flex' }, flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
      <Wordmark light /><Box sx={{ position: 'absolute', right: -180, top: '25%', width: 520, height: 520, borderRadius: '50%', border: '1px solid #45616d', '&:after': { content: '""', display: 'block', width: 380, height: 380, border: '1px solid #45616d', borderRadius: '50%', m: '68px' } }} />
      <Box sx={{ position: 'relative', maxWidth: 470, my: 10 }}><Box sx={{ width: 46, height: 4, bgcolor: '#ecaa58', mb: 4 }} /><Typography variant="h2" sx={{ fontSize: { md: 42, lg: 50 }, lineHeight: 1.17, fontWeight: 650, letterSpacing: -1.8 }}>{t('app.loginEditorial')}</Typography><Typography sx={{ color: '#b7ccd6', fontSize: 16, lineHeight: 1.8, mt: 3 }}>{t('app.loginDescription')}</Typography></Box>
      <Typography sx={{ fontSize: 12, color: '#9cb4bf' }}>{t('app.secureAccess')}</Typography>
    </Box>
    <Box sx={{ px: 4, py: 4, display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center"><Box sx={{ display: { xs: 'block', md: 'none' } }}><Wordmark /></Box><Box sx={{ ml: 'auto' }}><LanguageSwitch /></Box></Stack>
      <Box component="main" sx={{ width: '100%', maxWidth: 380, m: 'auto', py: 6 }}>
        <Typography variant="overline" sx={{ color: '#bc7826', letterSpacing: 2.5, fontWeight: 750 }}>WAFOU / {t('app.administration')}</Typography>
        <Typography component="h1" variant="h4" sx={{ mt: 2, mb: 1.5, fontWeight: 700, letterSpacing: -1.2 }}>{t('app.loginTitle')}</Typography>
        <Typography color="text.secondary" sx={{ mb: 4 }}>{t('app.loginSubtitle')}</Typography>
        <Box component="form" onSubmit={submit}><Stack spacing={2.5}>
          {error && <Alert severity="error" role="alert">{t(error)}</Alert>}
          <TextField label={t('app.email')} type="email" name="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required fullWidth disabled={busy} />
          <TextField label={t('app.password')} type="password" name="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required fullWidth disabled={busy} />
          <Button type="submit" variant="contained" size="large" disabled={busy} endIcon={busy ? <CircularProgress size={18} color="inherit" /> : <ArrowForwardRounded />} sx={{ py: 1.6, mt: 1 }}>{t(busy ? 'app.signingIn' : 'app.signIn')}</Button>
        </Stack></Box>
      </Box>
      <Typography align="center" color="text.secondary" variant="caption">WAFOU · {t('app.environment')}</Typography>
    </Box>
  </Box>;
}
