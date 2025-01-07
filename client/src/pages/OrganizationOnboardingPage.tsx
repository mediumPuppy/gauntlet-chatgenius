import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrganization } from '../contexts/OrganizationContext';
import { Navigation } from '../components/common/Navigation';

export default function OrganizationOnboardingPage() {
  const [organizationName, setOrganizationName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { createOrganization, joinOrganization } = useOrganization();

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await createOrganization(organizationName);
      navigate('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await joinOrganization(inviteCode);
      navigate('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join organization');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary-50 flex flex-col">
      <Navigation />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-lg border border-primary-100">
          <div>
            <h2 className="text-3xl font-bold text-primary-900">
              Welcome to ChatGenius
            </h2>
            <p className="mt-2 text-primary-700">
              Create or join an organization to get started
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-medium text-primary-900">Create an Organization</h3>
              <form onSubmit={handleCreateOrganization} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="organizationName" className="block text-sm font-medium text-primary-700">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    id="organizationName"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 bg-primary-50 border border-primary-200 text-primary-900 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent placeholder-primary-400"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 transition-colors disabled:bg-primary-300 disabled:text-primary-100"
                >
                  {isLoading ? 'Creating...' : 'Create Organization'}
                </button>
              </form>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-primary-100" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-primary-400">Or</span>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-medium text-primary-900">Join an Organization</h3>
              <p className="mt-2 text-sm text-primary-700 mb-4">
                Enter your invite code below to join an existing organization.
              </p>
              <form onSubmit={handleJoinOrganization} className="space-y-4">
                <div>
                  <label htmlFor="inviteCode" className="block text-sm font-medium text-primary-700">
                    Invite Code
                  </label>
                  <input
                    type="text"
                    id="inviteCode"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="Enter your invite code"
                    className="mt-1 block w-full px-3 py-2 bg-primary-50 border border-primary-200 text-primary-900 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent placeholder-primary-400"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 transition-colors disabled:bg-primary-300 disabled:text-primary-100"
                >
                  {isLoading ? 'Joining...' : 'Join Organization'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}