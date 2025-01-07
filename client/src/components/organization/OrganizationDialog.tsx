import React, { useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { Organization } from '../../types/organization';

interface OrganizationDialogProps {
  open: boolean;
  onClose: () => void;
}

export const OrganizationDialog: React.FC<OrganizationDialogProps> = ({ open, onClose }) => {
  const { organizations, createOrganization, setCurrentOrganization } = useOrganization();
  const [newOrgName, setNewOrgName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    
    setError(null);
    setIsCreating(true);
    try {
      const newOrg = await createOrganization(newOrgName.trim());
      setCurrentOrganization(newOrg);
      onClose();
    } catch (error) {
      setError('Failed to create organization');
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectOrg = (org: Organization) => {
    setCurrentOrganization(org);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">
            Select or Create Organization
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {organizations.length > 0 && (
          <>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Your Organizations
            </h3>
            <div className="space-y-1 mb-6">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => handleSelectOrg(org)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <div className="font-medium text-gray-800">{org.name}</div>
                  <div className="text-sm text-gray-500">
                    Created {new Date(org.created_at).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
            <div className="border-t border-gray-200 my-4" />
          </>
        )}

        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Create New Organization
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            placeholder="Organization Name"
            className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
              error 
                ? 'border-red-300 focus:ring-red-200' 
                : 'border-gray-300 focus:ring-blue-200'
            }`}
            disabled={isCreating}
          />
          <button
            onClick={handleCreateOrg}
            disabled={!newOrgName.trim() || isCreating}
            className={`px-4 py-2 rounded-md text-white font-medium ${
              !newOrgName.trim() || isCreating
                ? 'bg-blue-300 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            Create
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </div>
    </div>
  );
}; 