import React from 'react';
import ReactDOM from 'react-dom/client';
import { Admin, Resource, defaultTheme } from 'react-admin';
import { resources } from '@wafou/domain';
import { authProvider } from './authProvider';
import { dataProvider } from './dataProvider';
import { i18nProvider } from './i18n';
import { AdminLayout } from './Layout';
import { AdminLogin } from './Login';
import { Dashboard } from './Dashboard';
import { ResourceList, ResourceShow, ServiceCreate, ServiceEdit } from './ResourceViews';
import './styles.css';

const theme = {
  ...defaultTheme,
  palette: { mode: 'light' as const, primary: { main: '#173443' }, secondary: { main: '#d59643' }, background: { default: '#f4f6f8', paper: '#ffffff' }, text: { primary: '#203744', secondary: '#778994' } },
  typography: { fontFamily: "'Segoe UI', Inter, Arial, sans-serif", h6: { fontSize: 15, fontWeight: 700 }, button: { textTransform: 'none' as const, fontWeight: 650, fontSize: 12 } },
  shape: { borderRadius: 10 },
  sidebar: { width: 246, closedWidth: 64 },
  components: {
    ...defaultTheme.components,
    MuiCard: { styleOverrides: { root: { boxShadow: 'none', border: '1px solid #e3e9ed', borderRadius: 12 } } },
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 7 } } },
    MuiTableCell: { styleOverrides: { root: { borderBottom: '1px solid #edf0f2', padding: '15px 20px' }, head: { color: '#7c8b96', fontSize: 11, fontWeight: 650 } } },
  },
};
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>
  <Admin title="WAFOU" authProvider={authProvider} dataProvider={dataProvider} i18nProvider={i18nProvider}
    dashboard={Dashboard} layout={AdminLayout} loginPage={AdminLogin} theme={theme} darkTheme={null} requireAuth disableTelemetry>
    {Object.keys(resources).map(name => <Resource key={name} name={name} list={ResourceList} show={ResourceShow}
      create={name === 'services' ? ServiceCreate : undefined} edit={name === 'services' ? ServiceEdit : undefined}
      recordRepresentation={name === 'profiles' ? 'display_name' : name === 'services' ? 'name_fr' : 'id'} />)}
  </Admin>
</React.StrictMode>);
