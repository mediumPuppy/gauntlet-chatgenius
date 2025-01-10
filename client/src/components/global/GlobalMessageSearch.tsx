import React, { useState, useCallback, useRef } from 'react';
import { searchMessages } from '../../services/search';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface SearchResult {
  id: string;
  content: string;
  createdAt: string;
  channelId: string | null;
  dmId: string | null;
  senderName: string;
  messageIndex: number;
  channelName: string | null;
  dmRecipientName: string | null;
}

export function GlobalMessageSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
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

  const navigateToMessage = (result: SearchResult) => {
    const path = result.channelId 
      ? `/chat/channel/${result.channelId}`
      : `/chat/dm/${result.dmId}`;
    
    // Store the message to highlight in sessionStorage with additional flag
    sessionStorage.setItem('highlightMessage', JSON.stringify({
      id: result.id,
      index: result.messageIndex,
      fromSearch: true
    }));

    // Navigate and close search modal
    navigate(path);
    onClose();
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
            <div className="flex flex-col space-y-1">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <strong className="text-primary-600">{msg.senderName}</strong>
                  <span className="text-sm text-gray-500">in</span>
                  <span className="text-sm font-medium text-gray-700">
                    {msg.channelName ? (
                      <span className="flex items-center">
                        <span className="text-gray-400 mr-1">#</span>
                        {msg.channelName}
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <span className="text-gray-400 mr-1">@</span>
                        {msg.dmRecipientName}
                      </span>
                    )}
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  {new Date(msg.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-gray-700 truncate">{msg.content}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
