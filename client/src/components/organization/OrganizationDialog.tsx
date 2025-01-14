import React, { useState } from "react";
import { useOrganization } from "../../contexts/OrganizationContext";
import { Organization } from "../../types/organization";

interface OrganizationDialogProps {
  open: boolean;
  onClose: () => void;
}

export const OrganizationDialog: React.FC<OrganizationDialogProps> = ({
  open,
  onClose,
}) => {
  const {
    organizations,
    createOrganization,
    setCurrentOrganization,
    joinOrganization,
  } = useOrganization();
  const [newOrgName, setNewOrgName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
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
      setError("Failed to create organization");
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinOrg = async () => {
    if (!inviteCode.trim()) return;

    setError(null);
    setIsJoining(true);
    try {
      await joinOrganization(inviteCode.trim());
      onClose();
    } catch (error) {
      setError("Failed to join organization. Please check your invite code.");
      console.error(error);
    } finally {
      setIsJoining(false);
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
          <h2 className="text-xl font-semibold text-primary-900">
            Select or Create Organization
          </h2>
          <button
            onClick={onClose}
            className="text-primary-500 hover:text-primary-700"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {organizations.length > 0 && (
          <>
            <h3 className="text-sm font-medium text-primary-700 mb-2">
              Your Organizations
            </h3>
            <div className="space-y-1 mb-6">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => handleSelectOrg(org)}
                  className="w-full text-left px-4 py-2 hover:bg-primary-50 rounded-md transition-colors"
                >
                  <div className="font-medium text-primary-900">{org.name}</div>
                  <div className="text-sm text-primary-600">
                    Created {new Date(org.created_at).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
            <div className="border-t border-primary-100 my-4" />
          </>
        )}

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-primary-700 mb-2">
              Create New Organization
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Organization Name"
                className={`flex-1 px-3 py-2 bg-primary-50 border rounded-md focus:outline-none focus:ring-2 ${
                  error
                    ? "border-red-300 focus:ring-red-200"
                    : "border-primary-200 focus:ring-primary-500 text-primary-900"
                }`}
                disabled={isCreating}
              />
              <button
                onClick={handleCreateOrg}
                disabled={!newOrgName.trim() || isCreating}
                className={`px-4 py-2 rounded-md text-white font-medium ${
                  !newOrgName.trim() || isCreating
                    ? "bg-primary-300 cursor-not-allowed"
                    : "bg-primary-600 hover:bg-primary-700"
                }`}
              >
                {isCreating ? "Creating..." : "Create"}
              </button>
            </div>
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
            <h3 className="text-sm font-medium text-primary-700 mb-2">
              Join Organization
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Enter invite code"
                className={`flex-1 px-3 py-2 bg-primary-50 border rounded-md focus:outline-none focus:ring-2 ${
                  error
                    ? "border-red-300 focus:ring-red-200"
                    : "border-primary-200 focus:ring-primary-500 text-primary-900"
                }`}
                disabled={isJoining}
              />
              <button
                onClick={handleJoinOrg}
                disabled={!inviteCode.trim() || isJoining}
                className={`px-4 py-2 rounded-md text-white font-medium ${
                  !inviteCode.trim() || isJoining
                    ? "bg-primary-300 cursor-not-allowed"
                    : "bg-primary-600 hover:bg-primary-700"
                }`}
              >
                {isJoining ? "Joining..." : "Join"}
              </button>
            </div>
          </div>
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
};
