import { Link } from 'react-router-dom';
import { useOrganization } from '../contexts/OrganizationContext';
import { InviteCodeManager } from '../components/organization/InviteCodeManager';

export default function OrganizationSettingsPage() {
  const { currentOrganization, userRole } = useOrganization();

  if (!currentOrganization) {
    return (
      <div className="min-h-screen bg-primary-50 flex items-center justify-center">
        <div className="text-center text-primary-500">
          No organization selected
        </div>
      </div>
    );
  }

  const isAdmin = userRole === 'owner' || userRole === 'admin';

  return (
    <div className="min-h-screen bg-primary-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg border border-primary-100">
          {/* Header */}
          <div className="px-6 py-4 border-b border-primary-100 flex items-center">
            <Link
              to="/chat"
              className="mr-4 text-primary-600 hover:text-primary-700 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-2xl font-semibold text-primary-900">
              Organization Settings
            </h1>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-6">
            {/* Organization Info */}
            <div>
              <h2 className="text-lg font-medium text-primary-900 mb-4">
                Organization Information
              </h2>
              <div className="bg-primary-50 p-4 rounded-md border border-primary-100">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-primary-600">
                      Name
                    </label>
                    <div className="mt-1 text-sm text-primary-900">
                      {currentOrganization.name}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary-600">
                      Your Role
                    </label>
                    <div className="mt-1 text-sm text-primary-900">
                      {userRole}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Invite Codes Section */}
            {isAdmin && (
              <div>
                <h2 className="text-lg font-medium text-primary-900 mb-4">
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