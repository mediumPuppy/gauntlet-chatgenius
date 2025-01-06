import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useChannels } from '../contexts/ChannelContext';
import { MessageProvider } from '../contexts/MessageContext';
import { ChannelList } from '../components/chat/ChannelList';
import { MessageList } from '../components/chat/MessageList';
import { MessageInput } from '../components/chat/MessageInput';

export default function ChatPage() {
  const { channelId } = useParams();
  const { currentChannel, setCurrentChannel, channels } = useChannels();

  // Update current channel when URL parameter changes
  useEffect(() => {
    if (channelId && channels.length > 0) {
      const channel = channels.find(c => c.id === channelId);
      if (channel) {
        setCurrentChannel(channel);
      }
    }
  }, [channelId, channels, setCurrentChannel]);

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <div className="w-60 bg-gray-800 flex flex-col">
        {/* Workspace header */}
        <div className="h-12 bg-gray-900 flex items-center px-4">
          <h1 className="text-white font-bold">ChatGenius</h1>
        </div>
        
        {/* Channel list */}
        <div className="flex-1 overflow-y-auto">
          <ChannelList />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Channel header */}
        <div className="h-12 border-b flex items-center px-4">
          <h2 className="font-semibold">
            {currentChannel ? `# ${currentChannel.name}` : 'Select a channel'}
          </h2>
        </div>

        {currentChannel ? (
          <MessageProvider channelId={currentChannel.id}>
            <MessageList />
            <MessageInput />
          </MessageProvider>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a channel to start messaging
          </div>
        )}
      </div>
    </div>
  );
} 