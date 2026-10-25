export interface ButtonProps {
  label: string;
  onTap: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  busy?: boolean;
}

/**
 * A tappable control. Lynx has no `<button>` element, so the role is spelled
 * out for VoiceOver/TalkBack with `accessibility-element` + `-traits`; the
 * 48px minimum height is the WCAG 2.2 / Material touch-target floor.
 */
export function Button({ label, onTap, variant = 'primary', disabled, busy }: ButtonProps) {
  const inactive = disabled || busy;
  return (
    <view
      className={`Button Button--${variant}${inactive ? ' Button--disabled' : ''}`}
      accessibility-element
      accessibility-traits="button"
      accessibility-label={label}
      accessibility-value={busy ? '…' : undefined}
      bindtap={() => {
        if (!inactive) onTap();
      }}
    >
      <text className="Button__label">{busy ? `${label}…` : label}</text>
    </view>
  );
}
