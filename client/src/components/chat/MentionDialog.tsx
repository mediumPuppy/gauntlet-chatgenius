import { useState, useEffect, useRef, memo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { User } from '../../types/user';
import { UserAvatar } from '../common/UserAvatar';
import { useOrganization } from '../../contexts/OrganizationContext';
import { searchUsers } from '../../services/user';

interface MentionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (username: string) => void;
  searchQuery: string;
  position: { top: number; left: number };
}

const MentionDialog = memo(({ isOpen, onClose, onSelect, searchQuery, position }: MentionDialogProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { token } = useAuth();
  const { currentOrganization } = useOrganization();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searchQuery.trim() || !isOpen || !currentOrganization) {
      setUsers([]);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      try {
        const results = await searchUsers(token!, searchQuery, currentOrganization.id);
        setUsers(results);
        setSelectedIndex(0);
      } catch (error) {
        console.error('Failed to search users:', error);
      }
    }, 200);

    return () => clearTimeout(searchTimeout);
  }, [searchQuery, token, isOpen, currentOrganization]);

  return isOpen ? (
    <div 
      ref={dialogRef}
      className="absolute z-50 bg-white rounded-lg shadow-xl w-64 max-h-48 overflow-y-auto"
      style={{ top: position.top, left: position.left }}
    >
      {users.length > 0 ? (
        <ul className="py-1">
          {users.map((user, index) => (
            <li
              key={user.id}
              className={`px-3 py-2 cursor-pointer ${index === selectedIndex ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
              onClick={() => onSelect(user.username)}
            >
              <div className="flex items-center">
                <UserAvatar username={user.username} size="sm" />
                <span className="ml-2">{user.username}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-3 text-gray-500 text-sm">No users found</div>
      )}
    </div>
  ) : null;
});

export { MentionDialog };