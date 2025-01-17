import React, { useState, useRef, useCallback, useEffect } from "react";
import { useMessages } from "../../contexts/MessageContext";
import { useChannels } from "../../contexts/ChannelContext";
import { useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { getPresignedUrl } from "../../services/upload";
import { User } from "../../types/user";
import { searchUsers } from "../../services/user";
import { MentionDialog } from "./MentionDialog";
import { useOrganization } from "../../contexts/OrganizationContext";

// const MAX_PREVIEW_SIZE = 300; // pixels
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface FilePreview {
  file: File;
  previewUrl?: string;
  type: "image" | "other";
}

interface MessageInputProps {
  parentId?: string;
  placeholder?: string;
  isThread?: boolean;
  channelId?: string;
  isDM?: boolean;
}

export function MessageInput({
  parentId,
  placeholder,
  isThread = false,
  channelId,
  isDM = false,
}: MessageInputProps) {
  const [newMessage, setNewMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
  const { sendMessage, sendTyping } = useMessages();
  const { currentChannel } = useChannels();
  const { dmId } = useParams<{ dmId?: string }>();
  const { token } = useAuth();
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastTypingRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mentionState, setMentionState] = useState({
    isOpen: false,
    query: "",
    position: { top: 0, left: 0 },
    startIndex: 0,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { currentOrganization } = useOrganization();

  // If channelId/isDM are provided via props, use those. Otherwise, fall back to context
  const messageContext = useMessages();
  const effectiveChannelId = channelId || currentChannel?.id;
  const effectiveIsDM = isDM || messageContext.isDM;
  const isDisabled = (!effectiveChannelId && !effectiveIsDM && !isThread) || isUploading;

  const handleFileSelect = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      alert("File size must be less than 10MB");
      return;
    }

    const isImage = file.type.startsWith("image/");
    const preview: FilePreview = { file, type: isImage ? "image" : "other" };

    if (isImage) {
      const previewUrl = URL.createObjectURL(file);
      preview.previewUrl = previewUrl;
    }

    setFilePreview(preview);
  };

  const handleFileUpload = async (file: File) => {
    if (!token) return;

    try {
      setIsUploading(true);

      const { uploadUrl, key } = await getPresignedUrl(file.type, token);

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      const fileUrl = `https://chatgenius-joml.s3.us-east-2.amazonaws.com/${key}`;

      let messageContent;
      if (file.type.startsWith("image/")) {
        messageContent = `![${file.name}](${fileUrl})`;
      } else {
        messageContent = `[📎 ${file.name}](${fileUrl})`;
      }

      sendMessage(messageContent, parentId);
      setFilePreview(null);
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const removeFilePreview = () => {
    if (filePreview?.previewUrl) {
      URL.revokeObjectURL(filePreview.previewUrl);
    }
    setFilePreview(null);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const messageText = newMessage.trim();

    if (((!effectiveChannelId && !effectiveIsDM) && !isThread) || (!messageText && !filePreview)) {
      return;
    }

    try {
      if (filePreview) {
        await handleFileUpload(filePreview.file);
      }

      if (messageText) {
        sendMessage(messageText, parentId);
        setNewMessage("");
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleTyping = useCallback(() => {
    const now = Date.now();
    // Only send typing event if it's been more than 2 seconds since the last one
    // AND we have a valid channel/DM
    if ((!currentChannel && !dmId) || now - lastTypingRef.current < 2000) {
      return;
    }

    lastTypingRef.current = now;
    sendTyping();

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = undefined;
      lastTypingRef.current = 0; // Reset last typing time when typing stops
    }, 3000);
  }, [sendTyping, currentChannel, dmId]);

  const handleMentionSelect = (username: string) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const beforeMention = textarea.value.substring(0, mentionState.startIndex);
    const afterMention = textarea.value.substring(textarea.selectionStart);
    const newValue = `${beforeMention}@${username} ${afterMention}`;

    setNewMessage(newValue);
    setMentionState((prev) => ({ ...prev, isOpen: false }));

    // Set cursor position after the inserted mention
    const newCursorPosition = mentionState.startIndex + username.length + 2; // +2 for @ and space
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPosition, newCursorPosition);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionState.isOpen) {
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        if (users.length > 0) {
          handleMentionSelect(users[selectedIndex].username);
        }
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % users.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + users.length) % users.length);
        return;
      }
      if (e.key === "Escape") {
        setMentionState((prev) => ({ ...prev, isOpen: false }));
        return;
      }
    }

    if (e.key === "@") {
      const position = getCursorPosition();
      setMentionState({
        isOpen: true,
        query: "",
        position,
        startIndex: e.currentTarget.selectionStart,
      });
    }

    // Existing Cmd+Enter handling
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getPlaceholder = () => {
    let text = "";
    if (placeholder) {
      text = placeholder;
    } else if (dmId) {
      text = "Type your message...";
    } else if (currentChannel) {
      text = `Message #${currentChannel.name}`;
    } else {
      text = "Select a conversation to start messaging";
    }
    
    // Truncate with ellipsis if too long
    return text.length > 40 ? text.substring(0, 37) + "..." : text;
  };

  const getCursorPosition = () => {
    if (!textareaRef.current) return { top: 0, left: 0 };
    const textarea = textareaRef.current;
    const { selectionStart } = textarea;
    const textBeforeCursor = textarea.value.substring(0, selectionStart);

    const div = document.createElement("div");
    div.style.cssText = window.getComputedStyle(textarea, null).cssText;
    div.style.height = "auto";
    div.style.position = "absolute";
    div.textContent = textBeforeCursor;
    document.body.appendChild(div);

    const inputRect = textarea.getBoundingClientRect();
    const { width } = div.getBoundingClientRect();
    document.body.removeChild(div);

    return {
      top: inputRect.top - 10, // Position just above input
      left: inputRect.left + (width % inputRect.width),
    };
  };

  useEffect(() => {
    if (!mentionState.isOpen) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = textarea.value.substring(
      mentionState.startIndex,
      cursorPosition,
    );
    const match = textBeforeCursor.match(/@(\w*)/);

    if (!match) {
      setMentionState((prev) => ({ ...prev, isOpen: false }));
      return;
    }

    const query = match[1];
    setMentionState((prev) => ({ ...prev, query }));

    // Only search if there's actually a query (not just @)
    if (query.length > 0) {
      const searchTimeout = setTimeout(async () => {
        if (!currentOrganization?.id) return;
        try {
          const results = await searchUsers(
            token!,
            query,
            currentOrganization.id,
          );
          setUsers(results);
          setSelectedIndex(0);
        } catch (error) {
          console.error("Failed to search users:", error);
        }
      }, 200);

      return () => clearTimeout(searchTimeout);
    } else {
      // Clear users when there's no query
      setUsers([]);
    }
  }, [newMessage, mentionState.startIndex, mentionState.isOpen, token, currentOrganization]);

  return (
    <div className="h-auto min-h-[5rem] max-h-[16rem] border-t p-4 flex flex-col justify-end">
      <form onSubmit={handleSendMessage} className="flex flex-col gap-2">
        {filePreview && (
          <div className="overflow-y-auto max-h-[240px] pt-4">
            <div className="relative inline-block">
              {filePreview.type === "image" ? (
                <img
                  src={filePreview.previewUrl}
                  alt="Preview"
                  className="max-w-[300px] max-h-[200px] rounded-lg object-contain"
                />
              ) : (
                <div className="p-3 bg-gray-100 rounded-lg flex items-center">
                  <svg
                    className="w-6 h-6 text-gray-500 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                    />
                  </svg>
                  <span className="text-sm truncate max-w-[200px]">
                    {filePreview.file.name}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={removeFilePreview}
                className="absolute -top-4 -right-4 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 shadow-sm"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
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
          </div>
        )}

        <div className="bg-gray-50 rounded-lg flex sticky bottom-0">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleFileSelect(file);
              }
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isDisabled || isUploading}
            className="px-4 py-2 text-primary-600 hover:text-primary-700 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
          </button>
          <div className="relative flex-1">
            <textarea
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping();
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                } else {
                  handleKeyDown(e);
                }
              }}
              placeholder={getPlaceholder()}
              disabled={isDisabled || isUploading}
              className="flex-1 bg-transparent p-3 resize-none focus:outline-none disabled:cursor-not-allowed w-full h-full leading-normal text-[15px] placeholder:text-[15px] placeholder:truncate"
              style={{
                color: "inherit",
                lineHeight: "1.5rem",
                whiteSpace: "pre-wrap", // Allow wrapping for actual content
              }}
              rows={1}
              ref={textareaRef}
            />
            <div
              className="absolute inset-0 p-3 whitespace-pre-wrap break-words pointer-events-none"
              aria-hidden="true"
            >
              {newMessage.split(/(@\w+)/g).map((part, i) =>
                part.match(/^@\w+/) ? (
                  <span
                    key={i}
                    className="bg-yellow-100 rounded px-1 invisible"
                  >
                    {part}
                  </span>
                ) : (
                  <span key={i} className="invisible">
                    {part}
                  </span>
                ),
              )}
            </div>
          </div>
          <button
            type="submit"
            disabled={
              isDisabled || isUploading || (!newMessage.trim() && !filePreview)
            }
            className="px-4 py-2 text-primary-600 hover:text-primary-700 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 5l7 7-7 7M5 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>

        <MentionDialog
          isOpen={mentionState.isOpen}
          onClose={() => setMentionState((prev) => ({ ...prev, isOpen: false }))}
          onSelect={handleMentionSelect}
          searchQuery={mentionState.query}
          position={mentionState.position}
        />
      </form>
    </div>
  );
}
