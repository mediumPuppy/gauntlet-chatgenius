import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useChannels } from '../contexts/ChannelContext';
import { MessageProvider } from '../contexts/MessageContext';
import { ChannelList } from '../components/chat/ChannelList';
import { MessageList } from '../components/chat/MessageList';
import { MessageInput } from '../components/chat/MessageInput';

const HamburgerMenu = ({ onClick }: { onClick: () => void }) => (
  <button 
    onClick={onClick}
    className="lg:hidden p-2 hover:bg-primary-100 rounded-md"
    aria-label="Toggle menu"
  >
    <div className="w-[22px] h-[14px] relative flex flex-col justify-between">
      <div className="w-full h-[2.5px] bg-primary-800 rounded-full"></div>
      <div className="w-full h-[2.5px] bg-primary-800 rounded-full"></div>
      <div className="w-full h-[2.5px] bg-primary-800 rounded-full"></div>
    </div>
  </button>
);

export default function ChatPage() {
  const { channelId } = useParams();
  const { currentChannel, setCurrentChannel, channels } = useChannels();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (channelId && channels.length > 0) {
      const channel = channels.find(c => c.id === channelId);
      if (channel) {
        setCurrentChannel(channel);
      }
    }
  }, [channelId, channels, setCurrentChannel]);

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div className="h-screen flex relative">
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-20"
          onClick={closeSidebar}
        ></div>
      )}

      {/* Sidebar */}
      <div className={`
        w-60 bg-primary-700 flex flex-col
        fixed lg:static h-full
        transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        z-30
      `}>
        {/* Workspace header */}
        <div className="h-12 bg-primary-600 flex items-center px-4 border-b border-primary-500">
          <h1 className="text-2xl text-primary-100 font-bold">ChatGenius</h1>
        </div>
        
        {/* Channel list */}
        <div className="flex-1 overflow-y-auto pt-4">
          <ChannelList onChannelSelect={closeSidebar} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col bg-white min-w-0">
        {/* Channel header */}
        <div className="h-12 border-b flex items-center px-4 bg-primary-50">
          <HamburgerMenu onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
          <h2 className="text-lg font-semibold text-primary-900 ml-2">
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