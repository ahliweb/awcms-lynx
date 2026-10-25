export interface TextFieldProps {
  label: string;
  onChange: (value: string) => void;
  onConfirm?: () => void;
  type?: 'text' | 'number' | 'digit' | 'password' | 'tel' | 'email';
  placeholder?: string;
  maxlength?: number;
  defaultValue?: string;
  hint?: string;
  error?: string | null;
}

/**
 * A labelled single-line input. Lynx `<input>` is uncontrolled: the value
 * flows out through `bindinput` and is held by the caller.
 */
export function TextField(props: TextFieldProps) {
  const {
    label,
    onChange,
    onConfirm,
    type = 'text',
    placeholder,
    maxlength,
    defaultValue,
    hint,
    error,
  } = props;
  return (
    <view className="Field">
      <text className="Field__label">{label}</text>
      <input
        className={`Field__input${error ? ' Field__input--invalid' : ''}`}
        type={type}
        placeholder={placeholder}
        maxlength={maxlength}
        default-value={defaultValue}
        accessibility-label={label}
        confirm-type={onConfirm ? 'go' : 'done'}
        bindinput={(event) => onChange(event.detail.value)}
        bindconfirm={() => onConfirm?.()}
      />
      {hint ? <text className="Field__hint">{hint}</text> : null}
      {error ? (
        <text className="Field__error" accessibility-element accessibility-label={error}>
          {error}
        </text>
      ) : null}
    </view>
  );
}
