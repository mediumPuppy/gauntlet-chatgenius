import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useOrganization } from "../../contexts/OrganizationContext";
import { usePresence } from "../../contexts/PresenceContext";
import { searchUsers, startDM } from "../../services/user";
import { useNavigate } from "react-router-dom";
import { User } from "../../types/user";
import { UserAvatar } from "../common/UserAvatar";
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from "framer-motion";

interface StartDMDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StartDMDialog({ isOpen, onClose }: StartDMDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showLoading, setShowLoading] = useState(false);
  const { token, user: currentUser } = useAuth();
  const { currentOrganization } = useOrganization();
  const navigate = useNavigate();
  const { isUserOnline } = usePresence();

  useEffect(() => {
    // Clear everything when dialog closes
    if (!isOpen) {
      setSearchQuery("");
      setUsers([]);
      setError(null);
      return;
    }

    // Don't search if no query or organization
    if (!searchQuery.trim() || !currentOrganization) {
      setUsers([]);
      setError(null);
      return;
    }

    // Don't search until at least one character is typed
    if (searchQuery.trim().length < 1) return;

    let loadingTimeout: NodeJS.Timeout;
    const searchTimeout = setTimeout(async () => {
      try {
        loadingTimeout = setTimeout(() => {
          setShowLoading(true);
        }, 500);

        setError(null);
        const results = await searchUsers(
          token!,
          searchQuery,
          currentOrganization.id,
        );
        setUsers(results.filter((user: User) => user.id !== currentUser?.id));
      } catch (error) {
        console.error("Failed to search users:", error);
        setError("Failed to search users. Please try again.");
      } finally {
        clearTimeout(loadingTimeout);
        setShowLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(searchTimeout);
      clearTimeout(loadingTimeout);
    };
  }, [searchQuery, token, isOpen, currentUser, currentOrganization]);

  const handleStartDM = async (targetUserId: string) => {
    try {
      setError(null);
      const result = await startDM(token!, targetUserId);
      onClose();
      navigate(`/chat/dm/${result.id}`);
    } catch (error) {
      console.error("Failed to start DM:", error);
      setError("Failed to start conversation. Please try again.");
    }
  };

  return createPortal(
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="bg-white rounded-lg shadow-xl w-full max-w-md relative"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Start a Direct Message</h2>
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
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

            <div className="p-4">
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                autoFocus
              />

              {error && <div className="mt-2 text-red-500 text-sm">{error}</div>}

              <div className="mt-4 max-h-64 overflow-y-auto">
                {showLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                  </div>
                ) : users.length > 0 ? (
                  <ul className="space-y-2">
                    {users.map((user) => (
                      <li
                        key={user.id}
                        className="p-2 hover:bg-gray-100 rounded-md cursor-pointer flex items-center justify-between"
                        onClick={() => handleStartDM(user.id)}
                      >
                        <div className="flex items-center">
                          <UserAvatar
                            username={user.username}
                            isOnline={isUserOnline(user.id)}
                            size="sm"
                          />
                          <div className="ml-3">
                            <div className="font-medium">{user.username}</div>
                            <div className="text-sm text-gray-500">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : searchQuery ? (
                  <div className="text-center py-4 text-gray-500">
                    No users found
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    Start typing to search for users
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
