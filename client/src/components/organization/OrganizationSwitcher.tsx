import React, { useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { OrganizationDialog } from './OrganizationDialog';

export const OrganizationSwitcher: React.FC = () => {
  const { currentOrganization, organizations, setCurrentOrganization } = useOrganization();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showOrgDialog, setShowOrgDialog] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleOrgSelect = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    if (org) {
      setCurrentOrganization(org);
      localStorage.setItem('currentOrganizationId', org.id);
    }
    setIsMenuOpen(false);
  };

  const handleManageOrgs = () => {
    setIsMenuOpen(false);
    setShowOrgDialog(true);
  };

  if (!currentOrganization) return null;

  return (
    <div className="relative">
      <button
        onClick={toggleMenu}
        className="flex flex-col items-start px-4 py-2 text-white hover:bg-primary-600 rounded-md"
      >
        <span className="text-sm opacity-70">Organization</span>
        <span className="font-medium truncate max-w-[200px]">
          {currentOrganization.name}
        </span>
      </button>
      
      {isMenuOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsMenuOpen(false)}
          />
          
          {/* Dropdown menu */}
          <div className="absolute left-0 mt-1 w-64 bg-white rounded-md shadow-lg z-50">
            <div className="py-1">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => handleOrgSelect(org.id)}
                  className={`w-full text-left px-4 py-2 text-sm ${
                    org.id === currentOrganization.id
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {org.name}
                </button>
              ))}
              
              <div className="border-t border-gray-100 my-1" />
              
              <button
                onClick={handleManageOrgs}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Manage Organizations
              </button>
            </div>
          </div>
        </>
      )}

      <OrganizationDialog
        open={showOrgDialog}
        onClose={() => setShowOrgDialog(false)}
      />
    </div>
  );
}; 