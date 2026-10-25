export interface Tab<K extends string> {
  key: K;
  label: string;
}

export function TabBar<K extends string>({
  tabs,
  active,
  onSelect,
}: {
  tabs: Tab<K>[];
  active: K;
  onSelect: (key: K) => void;
}) {
  return (
    <view className="TabBar">
      {tabs.map((tab) => (
        <view
          key={tab.key}
          className={`TabBar__tab${tab.key === active ? ' TabBar__tab--active' : ''}`}
          accessibility-element
          accessibility-traits={tab.key === active ? 'selected' : 'button'}
          accessibility-label={tab.label}
          bindtap={() => onSelect(tab.key)}
        >
          <text className="TabBar__label">{tab.label}</text>
        </view>
      ))}
    </view>
  );
}
