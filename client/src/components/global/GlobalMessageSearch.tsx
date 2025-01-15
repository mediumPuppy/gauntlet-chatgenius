import React, { useState, useCallback, useRef, useEffect } from "react";
import { searchMessages } from "../../services/search";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { handleBotQuery } from "../../services/ai";
import { useChannels } from "../../contexts/ChannelContext";
import { useOrganization } from "../../contexts/OrganizationContext";
import { Combobox, Transition } from "@headlessui/react";
import { ChevronUpDownIcon, CheckIcon, ArrowLeftIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { SearchResult, ScopeOption } from "../../types/search";
import { SearchErrorBoundary } from "./SearchErrorBoundary";
import styles from "./GlobalMessageSearch.module.css";
import { CSSTransition, SwitchTransition } from 'react-transition-group';
import { BotResponse } from "./BotResponse";

// Add new interface for bot messages
interface BotMessage {
  content: string;
  timestamp: string;
  isBot: boolean;
}

export function GlobalMessageSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isBotMode, setIsBotMode] = useState(false);
  const [selectedScope, setSelectedScope] = useState<ScopeOption | null>(null);
  const [scopeQuery, setScopeQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorDetails, setErrorDetails] = useState<{
    message: string;
    code?: string;
    retry?: () => void;
  } | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [botMessages, setBotMessages] = useState<BotMessage[]>([]);
  
  const { token } = useAuth();
  const navigate = useNavigate();
  const { channels } = useChannels();
  const { currentOrganization } = useOrganization();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Enhanced scope options with descriptions
  const scopeOptions: ScopeOption[] = [
    {
      id: currentOrganization?.id || 'workspace',
      name: 'Entire Workspace',
      type: 'workspace',
      icon: '🏢',
      description: 'Search across all channels',
      color: 'bg-blue-50'
    },
    ...channels.map(channel => ({
      id: channel.id,
      name: channel.name,
      type: 'channel' as const,
      icon: '#',
      description: `Search in #${channel.name}`,
      color: 'bg-gray-50'
    }))
  ];

  // Filter scope options based on search
  const filteredOptions = scopeQuery === ''
    ? scopeOptions
    : scopeOptions.filter((option) =>
        option.name
          .toLowerCase()
          .includes(scopeQuery.toLowerCase())
      );

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Close on Escape
      if (e.key === 'Escape') {
        onClose();
      }
      
      // Focus search input on / key
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      // Toggle bot mode on Ctrl+B
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        setIsBotMode(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleError = useCallback((error: any, retryFn?: () => void) => {
    const message = error?.message || "An unexpected error occurred";
    const code = error?.code;
    
    setErrorDetails({
      message,
      code,
      retry: retryFn
    });
    
    console.error('[Search Error]:', {
      message,
      code,
      stack: error?.stack,
      timestamp: new Date().toISOString()
    });
  }, []);

  const handleSearch = useCallback(
    async (input: string) => {
      if (!input.trim()) return;
      
      try {
        setErrorDetails(null);
        setIsLoading(true);
        
        if (!isBotMode) {
          const data = await searchMessages(token!, input.trim());
          setResults(data);
        }
      } catch (err: any) {
        handleError(err, () => handleSearch(input));
      } finally {
        setIsLoading(false);
      }
    },
    [token, isBotMode, handleError]
  );

  const handleBotSubmit = async () => {
    if (!query.trim() || !selectedScope) return;

    try {
      setErrorDetails(null);
      setIsSending(true);
      setIsExpanded(true);
      
      const currentQuery = query;
      setQuery("");
      
      setBotMessages(prev => [...prev, {
        content: currentQuery,
        timestamp: new Date().toISOString(),
        isBot: false
      }]);
      scrollToBottom();

      const response = await handleBotQuery(token!, {
        content: currentQuery.trim(),
        ...(selectedScope.type === 'channel' 
          ? { channelId: selectedScope.id }
          : { workspaceId: selectedScope.id }
        )
      });

      setBotMessages(prev => [...prev, {
        content: response.answer,
        timestamp: new Date().toISOString(),
        isBot: true
      }]);
      scrollToBottom();

    } catch (err: any) {
      handleError(err, handleBotSubmit);
    } finally {
      setIsSending(false);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setQuery(newValue);

    if (!isBotMode) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        if (newValue.trim() !== "") {
          handleSearch(newValue);
        } else {
          setResults([]);
        }
      }, 300);
    }
  };

  const navigateToMessage = (result: SearchResult) => {
    const highlightId = result.parentId || result.id;

    const path = result.channelId
      ? `/chat/channel/${result.channelId}`
      : `/chat/dm/${result.dmId}`;

    sessionStorage.setItem(
      "highlightMessage",
      JSON.stringify({
        id: highlightId,
        index: result.messageIndex,
        fromSearch: true,
      }),
    );

    navigate(path);
    onClose();
  };

  // Loading skeleton for results
  const ResultSkeleton = () => (
    <div className={`${styles.resultItem} ${styles.skeleton}`}>
      <div className={styles.resultHeader}>
        <div className="h-4 w-24 bg-gray-300 rounded"></div>
        <div className="h-4 w-32 bg-gray-300 rounded"></div>
      </div>
      <div className="space-y-2 mt-2">
        <div className="h-4 w-full bg-gray-300 rounded"></div>
        <div className="h-4 w-3/4 bg-gray-300 rounded"></div>
      </div>
    </div>
  );

  const handleBackToSearch = () => {
    setIsExpanded(false);
    setQuery("");
    setResults([]);
  };

  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      const container = chatContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  // Force scroll position after any content changes
  useEffect(() => {
    if (botMessages.length > 0) {
      // Force immediate scroll without smooth behavior
      if (chatContainerRef.current) {
        chatContainerRef.current.style.scrollBehavior = 'auto';
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        chatContainerRef.current.style.scrollBehavior = 'smooth';
      }
    }
  }, [botMessages]);

  const handleScopeSelect = (scope: ScopeOption) => {
    setSelectedScope(scope);
    setScopeQuery(''); // Clear the search query
    setIsInputFocused(false); // Close dropdown
    // Small delay to ensure the dropdown closes before focusing the input
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  return (
    <SearchErrorBoundary>
      {isExpanded ? (
        <div className={styles.expandedContainer}>
          <div className={styles.expandedContent}>
            <div className={styles.expandedHeader}>
              <button
                onClick={handleBackToSearch}
                className={styles.backButton}
                aria-label="Back to search"
              >
                <ArrowLeftIcon className="h-6 w-6" />
              </button>
              <button
                onClick={onClose}
                className={styles.backButton}
                aria-label="Close search"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className={styles.expandedBody}>
              <div className={styles.chatContainer} ref={chatContainerRef}>
                {botMessages.map((message, index) => (
                  <div key={index} className={styles.botResponseExpanded}>
                    <BotResponse
                      content={message.content}
                      timestamp={message.timestamp}
                      isBot={message.isBot}
                    />
                  </div>
                ))}
              </div>
            </div>
            
            <div className={styles.expandedFooter}>
              <div className="flex space-x-2">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Ask a follow-up question..."
                  value={query}
                  onChange={handleInputChange}
                  className={styles.searchInput}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isSending) {
                      e.preventDefault();
                      handleBotSubmit();
                    }
                  }}
                />
                <button
                  onClick={handleBotSubmit}
                  disabled={!query.trim() || isSending}
                  className={styles.sendButton}
                  aria-label="Send message"
                >
                  {isSending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.searchContainer}>
          <div className={styles.modeToggle}>
            <button
              role="tab"
              aria-selected={!isBotMode}
              onClick={() => setIsBotMode(false)}
              className={`${styles.modeButton} ${!isBotMode ? styles.modeButtonActive : styles.modeButtonInactive}`}
            >
              <span className="sr-only">Switch to </span>
              Search
            </button>
            <button
              role="tab"
              aria-selected={isBotMode}
              onClick={() => setIsBotMode(true)}
              className={`${styles.modeButton} ${isBotMode ? styles.modeButtonActive : styles.modeButtonInactive}`}
            >
              <span className="sr-only">Switch to </span>
              Ask Bot
            </button>
          </div>

          <SwitchTransition mode="out-in">
            <CSSTransition
              key={isBotMode ? 'bot' : 'search'}
              timeout={300}
              classNames={{
                enter: styles.modeEnter,
                enterActive: styles.modeEnterActive,
                exit: styles.modeExit,
                exitActive: styles.modeExitActive
              }}
            >
              <div className={styles.modeSwitcher}>
                {isBotMode ? (
                  <div className={`${styles.modeContent} ${styles.modeTransition}`}>
                    <div className={styles.scopeSelector}>
                      <Combobox 
                        value={selectedScope} 
                        onChange={handleScopeSelect}
                        as="div"
                        aria-label="Select search scope"
                      >
                        <div className="relative">
                          <div className={styles.scopeInput}>
                            <Combobox.Input
                              className="w-full border-none py-2 pl-3 pr-10 text-sm leading-5 text-gray-900 focus:ring-0 bg-transparent"
                              displayValue={(scope: ScopeOption) => scope?.name || ''}
                              onChange={(event) => setScopeQuery(event.target.value)}
                              placeholder="Select scope..."
                              onFocus={() => setIsInputFocused(true)}
                              onBlur={() => setIsInputFocused(false)}
                            />
                            <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                              <ChevronUpDownIcon
                                className="h-5 w-5 text-gray-400"
                                aria-hidden="true"
                              />
                            </Combobox.Button>
                          </div>
                          <Transition
                            show={isInputFocused || scopeQuery !== ''}
                            leave="transition ease-in duration-100"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                            afterLeave={() => setScopeQuery('')}
                          >
                            <Combobox.Options className={styles.optionsList}>
                              {filteredOptions.map((option) => (
                                <Combobox.Option
                                  key={option.id}
                                  className={({ selected }) =>
                                    `${styles.option} ${selected ? styles.optionActive : styles.optionInactive} ${option.color}`
                                  }
                                  value={option}
                                >
                                  {({ selected }) => (
                                    <>
                                      <div className={styles.optionIcon}>
                                        <span>{option.icon}</span>
                                      </div>
                                      <div className={styles.optionText}>
                                        <span className={styles.optionName}>{option.name}</span>
                                        <span className={styles.optionDescription}>
                                          {option.description}
                                        </span>
                                      </div>
                                      {selected && (
                                        <CheckIcon className="h-5 w-5 text-primary-600 absolute right-2" />
                                      )}
                                    </>
                                  )}
                                </Combobox.Option>
                              ))}
                            </Combobox.Options>
                          </Transition>
                        </div>
                      </Combobox>
                    </div>
                    <div className={`flex space-x-2 ${styles.slideRight}`}>
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Ask a question... (Press Enter to send)"
                        value={query}
                        onChange={handleInputChange}
                        className={`${styles.searchInput} ${isLoading ? styles.loadingPulse : ''}`}
                        aria-label="Bot query input"
                        aria-busy={isLoading}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && isBotMode && !isSending) {
                            e.preventDefault();
                            handleBotSubmit();
                          }
                        }}
                      />
                      {isBotMode && (
                        <button
                          onClick={handleBotSubmit}
                          disabled={!selectedScope || isSending}
                          className={styles.sendButton}
                          aria-label="Send query to bot"
                          aria-busy={isSending}
                        >
                          {isSending ? (
                            <span className="flex items-center space-x-2" aria-hidden="true">
                              <span className={styles.loadingSpinner} />
                              <span>Sending</span>
                            </span>
                          ) : (
                            'Send'
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className={`${styles.modeContent} ${styles.modeTransition}`}>
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search messages... (Press / to focus)"
                      value={query}
                      onChange={handleInputChange}
                      className={styles.searchInput}
                      aria-label="Search input"
                      aria-busy={isLoading}
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </CSSTransition>
          </SwitchTransition>

          {errorDetails && (
            <div className={`${styles.errorMessage} ${styles.fadeIn}`}>
              <p>{errorDetails.message}</p>
              {errorDetails.retry && (
                <button
                  onClick={errorDetails.retry}
                  className={styles.retryButton}
                >
                  Retry
                </button>
              )}
            </div>
          )}

          <div className={styles.resultsContainer}>
            {isLoading ? (
              <>
                <ResultSkeleton />
                <ResultSkeleton />
                <ResultSkeleton />
              </>
            ) : (
              <>
                {!isBotMode && results.length === 0 && query.trim() !== "" && (
                  <p className={`${styles.noResults} ${styles.fadeIn}`}>
                    No messages found
                  </p>
                )}
                {results.map((msg) => (
                  <div
                    key={msg.id}
                    onClick={() => navigateToMessage(msg)}
                    className={`${styles.resultItem} ${styles.fadeIn}`}
                  >
                    <div className={styles.resultHeader}>
                      <div className="flex items-center space-x-2">
                        <span className={styles.resultSender}>{msg.senderName}</span>
                        <span className={styles.resultMeta}>in</span>
                        <span className={styles.resultMeta}>
                          {msg.channelName ? `#${msg.channelName}` : `@${msg.dmRecipientName}`}
                        </span>
                      </div>
                      <span className={styles.resultMeta}>
                        {new Date(msg.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className={styles.resultContent}>{msg.content}</p>
                  </div>
                ))}
                {isBotMode && results.length > 0 && (
                  <BotResponse
                    content={results[0].content}
                    timestamp={results[0].createdAt}
                    isBot={true}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </SearchErrorBoundary>
  );
}
