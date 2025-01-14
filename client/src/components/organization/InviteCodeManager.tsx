import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useOrganization } from "../../contexts/OrganizationContext";

import { API_URL } from "../../services/config";

interface InviteCode {
  code: string;
  expires_at: string;
  created_at: string;
}

export function InviteCodeManager() {
  const { token } = useAuth();
  const { currentOrganization } = useOrganization();
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchInviteCodes = async () => {
    if (!token || !currentOrganization) return;

    try {
      const response = await fetch(
        `${API_URL}/organizations/${currentOrganization.id}/invite-codes`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch invite codes");
      }

      const codes = await response.json();
      setInviteCodes(codes);
    } catch (error) {
      console.error("Error fetching invite codes:", error);
      setError(
        error instanceof Error ? error.message : "Failed to fetch invite codes",
      );
    } finally {
      setInitialLoading(false);
    }
  };

  const generateInviteCode = async () => {
    if (!token || !currentOrganization) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/organizations/${currentOrganization.id}/invite-code`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate invite code");
      }

      const newCode = await response.json();
      setInviteCodes((prev) => [newCode, ...prev]);
    } catch (error) {
      console.error("Error generating invite code:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to generate invite code",
      );
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  useEffect(() => {
    fetchInviteCodes();
  }, [currentOrganization?.id, token]);

  if (!currentOrganization) return null;

  if (initialLoading) {
    return (
      <div className="p-4 bg-white rounded-lg shadow">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Invite Codes</h2>
        <button
          onClick={generateInviteCode}
          disabled={loading}
          className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 disabled:bg-primary-300 transition-colors"
        >
          {loading ? "Generating..." : "Generate New Code"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {inviteCodes.map((invite) => (
          <div
            key={invite.code}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
          >
            <div>
              <div className="font-mono text-lg">{invite.code}</div>
              <div className="text-sm text-gray-500">
                Expires: {new Date(invite.expires_at).toLocaleDateString()}
              </div>
            </div>
            <button
              onClick={() => copyToClipboard(invite.code)}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              {copied === invite.code ? "Copied!" : "Copy"}
            </button>
          </div>
        ))}

        {inviteCodes.length === 0 && (
          <div className="text-center text-gray-500 py-4">
            No active invite codes. Generate one to invite team members.
          </div>
        )}
      </div>
    </div>
  );
}
