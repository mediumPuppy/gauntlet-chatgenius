import styles from './GlobalMessageSearch.module.css';

interface BotResponseProps {
  content: string;
  timestamp: string;
  isBot: boolean;
}

export function BotResponse({ content, timestamp, isBot }: BotResponseProps) {
  return (
    <div className={`${styles.botResponse} ${styles.slideIn} ${isBot ? styles.botMessage : styles.userMessage}`}>
      <div className={styles.botHeader}>
        <div className="flex items-center space-x-2">
          <span className={styles.botIcon}>{isBot ? '🤖' : '👤'}</span>
          <span className={styles.botName}>{isBot ? 'AI Assistant' : 'You'}</span>
        </div>
        <span className={styles.timestamp}>{timestamp}</span>
      </div>
      <div className={styles.botContent}>
        {content}
      </div>
    </div>
  );
} 