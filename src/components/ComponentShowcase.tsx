/**
 * Component Showcase & Examples
 * Demonstrates all UI components with real usage examples
 */

import React, { useState } from "react";
import {
  Card,
  Button,
  Input,
  Textarea,
  Badge,
  Alert,
  Progress,
  StatusIndicator,
  StatCard,
  EmptyState,
  Divider,
  Skeleton,
  colors,
  Typography,
} from "./ui";
import {
  Sidebar,
  MainLayout,
  Header,
  Content,
  StatsGrid,
  getDefaultNavigation,
} from "./Sidebar";
import {
  AlertCircle,
  CheckCircle,
  InfoIcon,
  TrendingUp,
  Users,
  DollarSign,
  Target,
} from "lucide-react";

// ============================================
// COMPONENT SHOWCASE PAGE
// ============================================

export function ComponentShowcase() {
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const nav = getDefaultNavigation();

  return (
    <MainLayout sidebar={<Sidebar sections={nav} />}>
      <Header
        title="Component Showcase"
        subtitle="All UI components and their variations"
        breadcrumbs={[{ label: "Design System" }, { label: "Components" }]}
      />

      <Content>
        {/* Section 1: Buttons */}
        <Section title="Buttons" description="All button variants and sizes">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button variant="primary">Primary Button</Button>
              <Button variant="secondary">Secondary Button</Button>
              <Button variant="ghost">Ghost Button</Button>
              <Button variant="destructive">Delete</Button>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button disabled>Disabled</Button>
              <Button isLoading>Loading...</Button>
            </div>
          </div>
        </Section>

        {/* Section 2: Cards */}
        <Section title="Cards" description="Card variants with different styles">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card variant="default" className="p-4">
              <h4 className="font-semibold mb-2">Default Card</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                With shadow and border
              </p>
            </Card>

            <Card variant="elevated" className="p-4">
              <h4 className="font-semibold mb-2">Elevated Card</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                With prominent shadow
              </p>
            </Card>

            <Card variant="outlined" className="p-4">
              <h4 className="font-semibold mb-2">Outlined Card</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Border only, minimal shadow
              </p>
            </Card>
          </div>
        </Section>

        {/* Section 3: Forms */}
        <Section title="Form Elements" description="Input, textarea, and form layouts">
          <div className="max-w-md space-y-4">
            <Input placeholder="Default input" />
            <Input placeholder="Input with error" error="This field is required" />
            <Textarea placeholder="Enter your message here..." rows={4} />
            <Button className="w-full">Submit</Button>
          </div>
        </Section>

        {/* Section 4: Badges */}
        <Section title="Badges" description="Status and category badges">
          <div className="flex flex-wrap gap-2">
            <Badge variant="default">Default</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="error">Error</Badge>
            <Badge variant="info">Info</Badge>
          </div>
        </Section>

        {/* Section 5: Alerts */}
        <Section title="Alerts" description="Alert messages and notifications">
          <div className="space-y-3">
            <Alert variant="success" icon={<CheckCircle className="h-5 w-5" />} title="Success">
              Your changes have been saved successfully.
            </Alert>
            <Alert variant="warning" icon={<AlertCircle className="h-5 w-5" />} title="Warning">
              Please review your settings before continuing.
            </Alert>
            <Alert variant="error" icon={<AlertCircle className="h-5 w-5" />} title="Error">
              Something went wrong. Please try again.
            </Alert>
            <Alert variant="info" icon={<InfoIcon className="h-5 w-5" />} title="Info">
              New features are available. Check them out!
            </Alert>
          </div>
        </Section>

        {/* Section 6: Progress */}
        <Section title="Progress Bars" description="Progress indicators and tracking">
          <div className="max-w-md space-y-6">
            <Progress value={30} label="Loading..." />
            <Progress value={65} label="Processing..." />
            <Progress value={100} label="Complete!" />
          </div>
        </Section>

        {/* Section 7: Status Indicators */}
        <Section title="Status Indicators" description="Connection and availability status">
          <div className="flex flex-wrap gap-6">
            <StatusIndicator status="online" />
            <StatusIndicator status="offline" />
            <StatusIndicator status="away" />
            <StatusIndicator status="busy" />
          </div>
        </Section>

        {/* Section 8: Stats Cards */}
        <Section title="Statistics Cards" description="Display metrics and KPIs">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Revenue"
              value="$125,400"
              trend={12}
              icon={<DollarSign className="h-6 w-6" />}
            />
            <StatCard
              label="Deals Closed"
              value="24"
              trend={5}
              icon={<Target className="h-6 w-6" />}
            />
            <StatCard
              label="Team Members"
              value="8"
              trend={0}
              icon={<Users className="h-6 w-6" />}
            />
            <StatCard
              label="Growth Rate"
              value="68%"
              trend={-2}
              icon={<TrendingUp className="h-6 w-6" />}
            />
          </div>
        </Section>

        {/* Section 9: Empty States */}
        <Section title="Empty States" description="Messages for empty content">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card variant="outlined" className="p-0">
              <EmptyState
                icon="🔍"
                title="No results found"
                description="Try adjusting your search filters"
              />
            </Card>

            <Card variant="outlined" className="p-0">
              <EmptyState
                icon="📝"
                title="No messages yet"
                description="Start a conversation to get started"
                action={<Button variant="primary">Send Message</Button>}
              />
            </Card>
          </div>
        </Section>

        {/* Section 10: Typography */}
        <Section title="Typography" description="Font sizes and styles">
          <div className="space-y-4">
            <div>
              <p className={Typography.H1}>Heading 1 (H1)</p>
              <p className="text-xs text-slate-500">text-4xl font-bold</p>
            </div>
            <div>
              <p className={Typography.H2}>Heading 2 (H2)</p>
              <p className="text-xs text-slate-500">text-3xl font-semibold</p>
            </div>
            <div>
              <p className={Typography.H3}>Heading 3 (H3)</p>
              <p className="text-xs text-slate-500">text-2xl font-semibold</p>
            </div>
            <div>
              <p className={Typography.P}>Body paragraph text (P)</p>
              <p className="text-xs text-slate-500">text-base leading-relaxed</p>
            </div>
            <div>
              <p className={Typography.Small}>Small text (Small)</p>
              <p className="text-xs text-slate-500">text-sm</p>
            </div>
          </div>
        </Section>

        {/* Section 11: Color Palette */}
        <Section title="Color Palette" description="Available colors and themes">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(colors).map(([name, value]) => {
              if (typeof value !== "string") return null;
              return (
                <div key={name} className="space-y-2">
                  <div className={`h-20 rounded-lg ${value}`} />
                  <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
                    {name}
                  </p>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Section 12: Dividers */}
        <Section title="Dividers" description="Content separators">
          <div className="space-y-4">
            <Divider />
            <Divider>Or continue with</Divider>
            <Divider>Section Break</Divider>
          </div>
        </Section>

        {/* Section 13: Skeletons */}
        <Section title="Loading Skeletons" description="Placeholder loaders">
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </Section>
      </Content>
    </MainLayout>
  );
}

// ============================================
// HELPER COMPONENT
// ============================================

interface SectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

const Section = ({ title, description, children }: SectionProps) => (
  <div className="mb-12">
    <div className="mb-6">
      <h2 className={`${Typography.H3} mb-2`}>{title}</h2>
      {description && <p className={colors.text.secondary}>{description}</p>}
    </div>
    <Card variant="outlined" className="p-6">
      {children}
    </Card>
  </div>
);

export default ComponentShowcase;
