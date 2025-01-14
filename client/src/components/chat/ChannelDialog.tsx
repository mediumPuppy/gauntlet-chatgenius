import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useOrganization } from "../../contexts/OrganizationContext";
import {
  createChannel,
  joinChannel,
  getAllChannels,
} from "../../services/channel";
import { useNavigate } from "react-router-dom";
import { useChannels } from "../../contexts/ChannelContext";

interface Channel {
  id: string;
  name: string;
  is_dm: boolean;
  created_at: string;
  organization_id: string;
}

interface ChannelDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChannelDialog({ isOpen, onClose }: ChannelDialogProps) {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [channelName, setChannelName] = useState("");
  const [loading, setLoading] = useState(false);
  const [availableChannels, setAvailableChannels] = useState<Channel[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const { token } = useAuth();
  const { currentOrganization } = useOrganization();
  const navigate = useNavigate();
  const { refreshChannels } = useChannels();

  useEffect(() => {
    if (isOpen && mode === "join" && currentOrganization) {
      const fetchChannels = async () => {
        try {
          setLoading(true);
          const channels = await getAllChannels(token!, currentOrganization.id);
          const publicChannels = channels.filter((channel) => !channel.is_dm);
          setAvailableChannels(publicChannels);
        } catch (error) {
          console.error("Failed to fetch channels:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchChannels();
    }
  }, [isOpen, mode, token, currentOrganization]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName.trim() || !currentOrganization) return;

    try {
      setLoading(true);
      if (mode === "create") {
        const channel = await createChannel(token!, {
          name: channelName.trim(),
          organization_id: currentOrganization.id,
        });
        await refreshChannels();
        navigate(`/chat/channel/${channel.id}`);
        onClose();
      }
    } catch (error) {
      console.error(`Failed to ${mode} channel:`, error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinChannel = async (channelId: string) => {
    try {
      setLoading(true);
      await joinChannel(token!, channelId);
      await refreshChannels();
      navigate(`/chat/channel/${channelId}`);
      onClose();
    } catch (error) {
      console.error("Failed to join channel:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredChannels = availableChannels.filter((channel) =>
    channel.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: "100vw",
        height: "100vh",
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md relative">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Channel Options</h2>
        </div>

        <div className="p-4">
          <div className="flex space-x-4 mb-4">
            <button
              onClick={() => setMode("create")}
              className={`flex-1 py-2 px-4 rounded-md ${
                mode === "create"
                  ? "bg-primary-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Create Channel
            </button>
            <button
              onClick={() => setMode("join")}
              className={`flex-1 py-2 px-4 rounded-md ${
                mode === "join"
                  ? "bg-primary-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Join Channel
            </button>
          </div>

          {mode === "create" ? (
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Enter new channel name..."
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                autoFocus
              />

              <div className="mt-4 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !channelName.trim()}
                  className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 disabled:opacity-50"
                >
                  {loading ? "Loading..." : "Create"}
                </button>
              </div>
            </form>
          ) : (
            <div>
              <input
                type="text"
                placeholder="Search channels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
                autoFocus
              />

              <div className="max-h-64 overflow-y-auto">
                {loading ? (
                  <div className="text-center py-4">Loading channels...</div>
                ) : filteredChannels.length > 0 ? (
                  <ul className="space-y-2">
                    {filteredChannels.map((channel) => (
                      <li
                        key={channel.id}
                        onClick={() => handleJoinChannel(channel.id)}
                        className="p-2 hover:bg-gray-100 rounded-md cursor-pointer flex items-center"
                      >
                        <span className="text-gray-400 mr-2">#</span>
                        <span>{channel.name}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    {searchQuery
                      ? "No channels found"
                      : "No channels available"}
                  </div>
                )}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
