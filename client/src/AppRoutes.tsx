import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useOrganization } from './contexts/OrganizationContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ChatPage from './pages/ChatPage';
import OrganizationOnboardingPage from './pages/OrganizationOnboardingPage';
import OrganizationSettingsPage from './pages/OrganizationSettingsPage';
import { ChannelProvider } from './contexts/ChannelContext';

export const AppRoutes: React.FC = () => {
  const { user, isLoading } = useAuth();
  const { currentOrganization } = useOrganization();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  // If user is logged in but has no organization, redirect to onboarding
  const authenticatedRedirect = user 
    ? (currentOrganization ? '/chat' : '/organization-onboarding')
    : '/login';

  return (
    <Routes>
      <Route 
        path="/" 
        element={<LandingPage />} 
      />
      <Route 
        path="/login" 
        element={user && !isLoading ? <Navigate to={authenticatedRedirect} replace /> : <LoginPage />} 
      />
      <Route 
        path="/signup" 
        element={user && !isLoading ? <Navigate to={authenticatedRedirect} replace /> : <SignupPage />} 
      />
      <Route
        path="/organization-onboarding"
        element={
          <ProtectedRoute>
            {currentOrganization ? <Navigate to="/chat" replace /> : <OrganizationOnboardingPage />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/organization/settings"
        element={
          <ProtectedRoute>
            {!currentOrganization ? (
              <Navigate to="/organization-onboarding" replace />
            ) : (
              <OrganizationSettingsPage />
            )}
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat/*"
        element={
          <ProtectedRoute>
            {!currentOrganization ? (
              <Navigate to="/organization-onboarding" replace />
            ) : (
              <ChannelProvider>
                <Routes>
                  <Route index element={<ChatPage />} />
                  <Route path="channel/:channelId" element={<ChatPage />} />
                  <Route path="dm/:dmId" element={<ChatPage />} />
                </Routes>
              </ChannelProvider>
            )}
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}; 