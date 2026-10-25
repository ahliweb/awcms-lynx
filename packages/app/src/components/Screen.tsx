import type { ReactNode } from '@lynx-js/react';

export interface ScreenProps {
  title: string;
  children: ReactNode;
}

/** A titled, vertically scrolling page body. */
export function Screen({ title, children }: ScreenProps) {
  return (
    <view className="Screen">
      <view className="Screen__header">
        <text className="Screen__title" accessibility-element accessibility-heading>
          {title}
        </text>
      </view>
      <scroll-view className="Screen__body" scroll-orientation="vertical">
        <view className="Screen__content">{children}</view>
      </scroll-view>
    </view>
  );
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <view className="Section">
      {title ? (
        <text className="Section__title" accessibility-element accessibility-heading>
          {title}
        </text>
      ) : null}
      {children}
    </view>
  );
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <view className="Row" accessibility-element accessibility-label={`${label}: ${value}`}>
      <text className="Row__label">{label}</text>
      <text className="Row__value">{value}</text>
    </view>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <view className="Loading" accessibility-element accessibility-label={label}>
      <text className="Loading__text">{label}</text>
    </view>
  );
}
