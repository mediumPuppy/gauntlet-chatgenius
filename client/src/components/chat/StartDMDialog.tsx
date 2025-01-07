import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { searchUsers, startDM } from '../../services/user';
import { useNavigate } from 'react-router-dom';
import { User } from '../../types/user';

interface StartDMDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StartDMDialog({ isOpen, onClose }: StartDMDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const { token, user: currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!searchQuery.trim() || !isOpen) {
      setUsers([]);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      try {
        setLoading(true);
        const results = await searchUsers(token!, searchQuery);
        setUsers(results.filter((user: User) => user.id !== currentUser?.id));
      } catch (error) {
        console.error('Failed to search users:', error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [searchQuery, token, isOpen, currentUser]);

  const handleStartDM = async (targetUserId: string) => {
    try {
      setLoading(true);
      const { dmId } = await startDM(token!, targetUserId);
      onClose();
      navigate(`/chat/dm/${dmId}`);
    } catch (error) {
      console.error('Failed to start DM:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" style={{ position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh' }}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md relative">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Start a Direct Message</h2>
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
          
          <div className="mt-4 max-h-64 overflow-y-auto">
            {loading ? (
              <div className="text-center py-4">Loading...</div>
            ) : users.length > 0 ? (
              <ul className="space-y-2">
                {users.map((user) => (
                  <li
                    key={user.id}
                    className="p-2 hover:bg-gray-100 rounded-md cursor-pointer flex items-center justify-between"
                    onClick={() => handleStartDM(user.id)}
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 mr-3">
                        {user.username[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">{user.username}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : searchQuery ? (
              <div className="text-center py-4 text-gray-500">No users found</div>
            ) : null}
          </div>
        </div>
        
        <div className="p-4 border-t flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
} 