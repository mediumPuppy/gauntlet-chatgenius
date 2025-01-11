import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { PresenceProvider } from './contexts/PresenceContext';
import { AppRoutes } from './AppRoutes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <OrganizationProvider>
            <WebSocketProvider>
              <PresenceProvider>
                <AppRoutes />
              </PresenceProvider>
            </WebSocketProvider>
          </OrganizationProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
