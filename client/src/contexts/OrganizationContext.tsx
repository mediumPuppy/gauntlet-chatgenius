import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

interface Organization {
  id: string;
  name: string;
  created_by: string;
  created_at: Date;
}

interface OrganizationContextType {
  currentOrganization: Organization | null;
  organizations: Organization[];
  userRole: string | null;
  setCurrentOrganization: (org: Organization | null) => void;
  refreshOrganizations: () => Promise<void>;
  createOrganization: (name: string) => Promise<Organization>;
  inviteMember: (email: string) => Promise<void>;
  joinOrganization: (inviteCode: string) => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | null>(null);

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);

  const refreshOrganizations = useCallback(async () => {
    if (!user || !token) return;

    try {
      const response = await fetch('/api/organizations/user', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const text = await response.text();
      console.log('Raw API response:', text); // Debug log
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        throw new Error(`Failed to fetch organizations: ${text}`);
      }
      
      if (!text.trim()) {
        setOrganizations([]);
        return;
      }

      try {
        // Try to clean the response text of any BOM or whitespace
        const cleanText = text.trim().replace(/^\uFEFF/, '');
        console.log('Cleaned text for parsing:', cleanText);
        const orgs = JSON.parse(cleanText);
        if (!Array.isArray(orgs)) {
          throw new Error('Invalid response format');
        }
        setOrganizations(orgs);

        // Set current organization from localStorage or first available
        const savedOrgId = localStorage.getItem('currentOrganizationId');
        const targetOrg = orgs.find((org: Organization) => org.id === savedOrgId) || orgs[0];
        if (targetOrg) {
          setCurrentOrganization(targetOrg);
          localStorage.setItem('currentOrganizationId', targetOrg.id);
        }
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        throw new Error(`Invalid JSON response: ${text}`);
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
      setOrganizations([]);
    }
  }, [user, token]);

  const createOrganization = async (name: string): Promise<Organization> => {
    if (!token) throw new Error('Not authenticated');

    const response = await fetch('/api/organizations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name })
    });

    if (!response.ok) throw new Error('Failed to create organization');

    const newOrg = await response.json();
    
    // Create a default "general" channel
    try {
      await fetch('/api/channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          name: 'general',
          is_dm: false,
          organization_id: newOrg.id
        })
      });
    } catch (error) {
      console.error('Failed to create default channel:', error);
    }

    await refreshOrganizations();
    return newOrg;
  };

  const inviteMember = async (email: string): Promise<void> => {
    if (!token || !currentOrganization) throw new Error('Not authenticated or no organization selected');

    const response = await fetch(`/api/organizations/${currentOrganization.id}/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ email })
    });

    if (!response.ok) throw new Error('Failed to invite member');
  };

  const joinOrganization = async (inviteCode: string): Promise<void> => {
    if (!token) throw new Error('Not authenticated');

    const response = await fetch('/api/organizations/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ inviteCode })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Failed to join organization');
    }

    await refreshOrganizations();
  };

  useEffect(() => {
    if (user) {
      refreshOrganizations();
    } else {
      setOrganizations([]);
      setCurrentOrganization(null);
    }
  }, [user, refreshOrganizations]);

  // Fetch user role when current organization changes
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!currentOrganization || !token) {
        setUserRole(null);
        return;
      }

      try {
        const response = await fetch(`/api/organizations/${currentOrganization.id}/role`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) throw new Error('Failed to fetch user role');
        
        const { role } = await response.json();
        setUserRole(role);
      } catch (error) {
        console.error('Error fetching user role:', error);
        setUserRole(null);
      }
    };

    fetchUserRole();
  }, [currentOrganization, token]);

  return (
    <OrganizationContext.Provider
      value={{
        currentOrganization,
        organizations,
        userRole,
        setCurrentOrganization,
        refreshOrganizations,
        createOrganization,
        inviteMember,
        joinOrganization
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}; 