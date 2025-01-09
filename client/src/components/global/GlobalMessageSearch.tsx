import React, { useState, useCallback, useRef } from 'react';
import { searchMessages } from '../../services/search';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export function GlobalMessageSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();
  const navigate = useNavigate();

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearch = useCallback(async (input: string) => {
    try {
      setError(null);
      const data = await searchMessages(token!, input.trim());
      setResults(data);
    } catch (err: any) {
      setError(err.message || 'Failed to search messages');
    }
  }, [token]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setQuery(newValue);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      if (newValue.trim() !== '') {
        handleSearch(newValue);
      } else {
        setResults([]);
      }
    }, 300);
  };

  const navigateToMessage = (result: any) => {
    // Logic to navigate to the specific channel/DM
    if (result.channelId) {
      navigate(`/channels/${result.channelId}`);
    } else if (result.dmId) {
      navigate(`/dm/${result.dmId}`);
    }
  };

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search messages..."
        value={query}
        onChange={handleInputChange}
        className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
      />

      {error && <div className="text-red-500">{error}</div>}

      {results.length === 0 && query.trim() !== '' && (
        <p className="text-gray-500">No messages found</p>
      )}

      <ul className="space-y-2">
        {results.map(msg => (
          <li 
            key={msg.id} 
            onClick={() => navigateToMessage(msg)}
            className="p-3 bg-gray-100 rounded-md hover:bg-gray-200 cursor-pointer transition"
          >
            <div className="flex justify-between items-center">
              <div>
                <strong className="text-primary-600">{msg.senderName}</strong>
                <p className="text-gray-700 truncate max-w-md">{msg.content}</p>
              </div>
              <span className="text-sm text-gray-500">
                {new Date(msg.createdAt).toLocaleString()}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
