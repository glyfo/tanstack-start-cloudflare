import type { A2UIComponent } from '@/types/a2ui-schema';

interface A2UIRendererProps {
  components: A2UIComponent[];
  isLoading?: boolean;
}

/**
 * A2UI Component Renderer
 * Renders declarative component tree to React components
 */
export function A2UIRenderer({
  components,
  isLoading,
}: A2UIRendererProps) {
  return (
    <div className="space-y-3 text-gray-300">
      {components.map((comp, idx) => (
        <A2UIComponentRenderer key={idx} component={comp} />
      ))}

      {isLoading && (
        <div className="mt-2 flex items-center gap-1">
          <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
          <span className="text-xs text-gray-400">Streaming response...</span>
        </div>
      )}
    </div>
  );
}

interface ComponentProps {
  component: A2UIComponent;
}

function A2UIComponentRenderer({ component }: ComponentProps) {
  const { type, props = {}, children } = component;

  switch (type) {
    case 'heading':
      return <HeadingComponent {...(props as any)} />;
    case 'text':
      return <TextComponent {...(props as any)} />;
    case 'metric':
      return <MetricComponent {...(props as any)} />;
    case 'list':
      return <ListComponent {...(props as any)} />;
    case 'card':
      return (
        <CardComponent {...(props as any)}>
          {children?.map((child, idx) => (
            <A2UIComponentRenderer key={idx} component={child} />
          ))}
        </CardComponent>
      );
    case 'section':
      return (
        <SectionComponent {...(props as any)}>
          {children?.map((child, idx) => (
            <A2UIComponentRenderer key={idx} component={child} />
          ))}
        </SectionComponent>
      );
    default:
      return null;
  }
}

/**
 * Heading Component
 */
interface HeadingProps {
  level: 1 | 2 | 3;
  text: string;
}

function HeadingComponent({ level, text }: HeadingProps) {
  const styles: Record<number, string> = {
    1: 'text-2xl font-bold text-white mb-3 mt-4',
    2: 'text-xl font-bold text-gray-100 mb-2 mt-3',
    3: 'text-lg font-semibold text-gray-200 mb-2 mt-2',
  };

  const Tag = (`h${level}` as any) as React.ElementType;
  return <Tag className={styles[level]}>{text}</Tag>;
}

/**
 * Text Component
 */
interface TextProps {
  content: string;
}

function TextComponent({ content }: TextProps) {
  return <p className="text-gray-300 mb-2 leading-relaxed text-sm">{content}</p>;
}

/**
 * Metric Component - Display key/value pairs
 */
interface MetricProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

function MetricComponent({
  label,
  value,
  unit,
  trend,
  trendValue,
}: MetricProps) {
  const trendColors: Record<string, string> = {
    up: 'text-green-400',
    down: 'text-red-400',
    neutral: 'text-gray-400',
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded border border-gray-700 hover:border-blue-500/50 transition-colors">
      <div>
        <p className="text-gray-400 text-sm">{label}</p>
        <p className="text-lg font-semibold text-white">
          {value}
          {unit && <span className="text-gray-400 text-sm ml-1">{unit}</span>}
        </p>
      </div>
      {trend && trendValue && (
        <div className={`text-sm font-semibold ${trendColors[trend]}`}>
          {trend === 'up' && '↑'} {trend === 'down' && '↓'} {trendValue}
        </div>
      )}
    </div>
  );
}

/**
 * List Component
 */
interface ListProps {
  items: string[];
  ordered?: boolean;
  style?: 'bullet' | 'number' | 'check';
}

function ListComponent({ items, style = 'bullet' }: ListProps) {
  const iconMap: Record<string, string> = {
    bullet: '•',
    number: '◆',
    check: '✓',
  };

  return (
    <div className="space-y-2 ml-2">
      {items.map((item, idx) => (
        <div key={idx} className="flex gap-2 text-gray-300 text-sm">
          <span className="text-blue-400 shrink-0">
            {style === 'number' ? `${idx + 1}.` : iconMap[style]}
          </span>
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Card Component - Container with title
 */
interface CardProps {
  title?: string;
  subtitle?: string;
  style?: 'default' | 'highlight' | 'warning';
  children?: React.ReactNode;
}

function CardComponent({
  title,
  subtitle,
  style = 'default',
  children,
}: CardProps) {
  const styleClasses: Record<string, string> = {
    default: 'bg-gray-800/50 border-gray-700',
    highlight: 'bg-blue-900/20 border-blue-500/30',
    warning: 'bg-red-900/20 border-red-500/30',
  };

  return (
    <div className={`rounded-lg p-4 border ${styleClasses[style]} space-y-3`}>
      {title && (
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {subtitle && (
            <p className="text-sm text-gray-400">{subtitle}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * Section Component - Grouped content
 */
interface SectionProps {
  title?: string;
  children?: React.ReactNode;
}

function SectionComponent({ children }: SectionProps) {
  return (
    <div className="space-y-3">
      {children}
    </div>
  );
}
