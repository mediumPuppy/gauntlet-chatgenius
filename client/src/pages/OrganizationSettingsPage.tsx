import React from 'react';
import { useOrganization } from '../contexts/OrganizationContext';
import { InviteCodeManager } from '../components/organization/InviteCodeManager';

export default function OrganizationSettingsPage() {
  const { currentOrganization, userRole } = useOrganization();

  if (!currentOrganization) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center text-gray-500">
          No organization selected
        </div>
      </div>
    );
  }

  const isAdmin = userRole === 'owner' || userRole === 'admin';

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-semibold text-gray-900">
              Organization Settings
            </h1>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-6">
            {/* Organization Info */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Organization Information
              </h2>
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      Name
                    </label>
                    <div className="mt-1 text-sm text-gray-900">
                      {currentOrganization.name}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      Your Role
                    </label>
                    <div className="mt-1 text-sm text-gray-900">
                      {userRole}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Invite Codes Section */}
            {isAdmin && (
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Manage Invites
                </h2>
                <InviteCodeManager />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 