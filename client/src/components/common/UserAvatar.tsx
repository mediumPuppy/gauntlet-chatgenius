import React from 'react';

interface UserAvatarProps {
  username: string;
  isOnline?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showPresence?: boolean;
}

export function UserAvatar({ username, isOnline = false, size = 'md', showPresence = true }: UserAvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg'
  };

  const presenceSizeClasses = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-3.5 h-3.5'
  };

  return (
    <div className="relative inline-block">
      <div 
        className={`${sizeClasses[size]} rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-medium`}
      >
        {username[0].toUpperCase()}
      </div>
      
      {showPresence && (
        <div 
          className={`absolute bottom-0 right-0 ${presenceSizeClasses[size]} rounded-full border-2 border-white ${
            isOnline ? 'bg-green-500' : 'bg-gray-400'
          }`}
        />
      )}
    </div>
  );
} 