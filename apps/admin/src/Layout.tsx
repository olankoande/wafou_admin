import { AppBar, Layout, Menu, usePermissions, useTranslate, type LayoutProps } from 'react-admin';
import { Box, Chip, Typography } from '@mui/material';
import PeopleOutline from '@mui/icons-material/PeopleOutline';
import CleaningServicesOutlined from '@mui/icons-material/CleaningServicesOutlined';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined';
import SupportAgentOutlined from '@mui/icons-material/SupportAgentOutlined';
import SecurityOutlined from '@mui/icons-material/SecurityOutlined';
import { resources, type ResourceName } from '@wafou/domain';
import { LanguageSwitch, Wordmark } from './components';

const icons = { people: PeopleOutline, catalog: CleaningServicesOutlined, operations: CalendarMonthOutlined, finance: AccountBalanceWalletOutlined, support: SupportAgentOutlined, system: SecurityOutlined };
function AdminMenu() {
  const t = useTranslate();
  const { permissions = [] } = usePermissions<string[]>();
  return <Menu sx={{ mt: 2, px: 1.5 }}>
    <Menu.DashboardItem primaryText={t('app.overview')} />
    {permissions.includes('catalog.read') && permissions.includes('finance.read') && <Menu.Item to="/pricing-preview" primaryText={t('billing.preview')} leftIcon={<AccountBalanceWalletOutlined fontSize="small" />} />}
    {Object.entries(icons).map(([group, Icon]) => {
      const entries = (Object.keys(resources) as ResourceName[]).filter(key => resources[key].group === group && permissions.includes(resources[key].permission));
      if (!entries.length) return null;
      return <Box key={group} sx={{ mt: 2 }}>
        <Typography sx={{ fontSize: 9, fontWeight: 750, letterSpacing: 1.4, px: 2, py: 1.2, color: '#94aeb9' }}>{t(`app.groups.${group}`)}</Typography>
        {entries.map(key => <Menu.Item key={key} to={`/${key}`} primaryText={t(`resources.${key}.name`)} leftIcon={<Icon fontSize="small" />} />)}
      </Box>;
    })}
  </Menu>;
}
function AdminAppBar() {
  const t = useTranslate();
  return <AppBar color="inherit" sx={{ boxShadow: 'none', borderBottom: '1px solid #e5eaed', '& .RaAppBar-toolbar': { minHeight: 72, gap: 2 } }}>
    <Wordmark /><Typography variant="body2" sx={{ color: 'text.secondary', borderLeft: '1px solid #d8e0e4', pl: 2, display: { xs: 'none', sm: 'block' } }}>{t('app.administration')}</Typography>
    <Box sx={{ flex: 1 }} /><Chip label={t('app.environment')} size="small" sx={{ bgcolor: '#fff3df', color: '#8c5a16', display: { xs: 'none', md: 'flex' } }} /><LanguageSwitch />
  </AppBar>;
}
export function AdminLayout(props: LayoutProps) {
  return <Layout {...props} appBar={AdminAppBar} menu={AdminMenu} sx={{
    '& .RaSidebar-fixed': { bgcolor: '#173443', color: '#e3edf1', minHeight: 'calc(100vh - 72px)', pb: 4 },
    '& .RaMenuItemLink-root': { color: '#d8e6ed', fontSize: 12.5, minHeight: 37, borderRadius: 1.5, mb: .3 },
    '& .RaMenuItemLink-root .MuiListItemIcon-root': { color: '#8eabb9', minWidth: 32 },
    '& .RaMenuItemLink-active': { bgcolor: '#2b4858', color: '#fff', borderLeft: '3px solid #eda750' },
    '& .RaMenuItemLink-active .MuiListItemIcon-root': { color: '#f3b465' },
    '& .RaMenuItemLink-root.RaMenuItemLink-active .MuiTypography-root': { color: '#fff' },
    '& .RaLayout-content': { p: { xs: 2, md: 3.5 }, bgcolor: '#f4f6f8', minWidth: 0 },
  }} />;
}
