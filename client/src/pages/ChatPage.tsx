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
      <div className="w-60 bg-primary-700 flex flex-col">
        {/* Workspace header */}
        <div className="h-12 bg-primary-600 flex items-center px-4 border-b border-primary-500">
          <h1 className="text-2xl text-primary-100 font-bold">ChatGenius</h1>
        </div>
        
        {/* Channel list */}
        <div className="flex-1 overflow-y-auto pt-4">
          <ChannelList />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Channel header */}
        <div className="h-12 border-b flex items-center px-4 bg-primary-50">
          <h2 className="text-lg font-semibold text-primary-900">
            {currentChannel ? `${currentChannel.is_dm ? '' : '#'}${currentChannel.name}` : 'Select a channel'}
          </h2>
        </div>

        {currentChannel ? (
          <MessageProvider channelId={currentChannel.id}>
            <MessageList />
            <MessageInput />
          </MessageProvider>
        ) : (
          <div className="flex-1 flex items-center justify-center text-primary-500">
            Select a channel to start messaging
          </div>
        )}
      </div>
    </div>
  );
} 