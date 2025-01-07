import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { OrganizationProvider, useOrganization } from './contexts/OrganizationContext';
import { AppRoutes } from './AppRoutes';
import { OrganizationDialog } from './components/organization/OrganizationDialog';

const AppContent: React.FC = () => {
  const { user } = useAuth();
  const { currentOrganization, organizations } = useOrganization();
  const [showOrgDialog, setShowOrgDialog] = useState(false);

  useEffect(() => {
    if (user && organizations.length > 0 && !currentOrganization) {
      setShowOrgDialog(true);
    }
  }, [user, organizations, currentOrganization]);

  return (
    <>
      <AppRoutes />
      <OrganizationDialog
        open={showOrgDialog}
        onClose={() => setShowOrgDialog(false)}
      />
    </>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <OrganizationProvider>
          <AppContent />
        </OrganizationProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;
