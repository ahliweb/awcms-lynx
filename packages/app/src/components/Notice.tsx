export interface NoticeProps {
  tone: 'info' | 'error' | 'success' | 'warning';
  message: string;
}

export function Notice({ tone, message }: NoticeProps) {
  return (
    <view
      className={`Notice Notice--${tone}`}
      accessibility-element
      accessibility-label={message}
      accessibility-traits={tone === 'error' ? 'text' : undefined}
    >
      <text className="Notice__text">{message}</text>
    </view>
  );
}
