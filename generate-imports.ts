#!/usr/bin/env node
/**
 * Component Import Generator
 * Generates import statements for UI components
 *
 * Run: npx ts-node generate-imports.ts
 */

const componentMap = {
  // Base Components
  base: {
    Card: "src/components/ui",
    Button: "src/components/ui",
    Input: "src/components/ui",
    Textarea: "src/components/ui",
    Badge: "src/components/ui",
    Alert: "src/components/ui",
    Separator: "src/components/ui",
    Skeleton: "src/components/ui",
    StatusIndicator: "src/components/ui",
    StatCard: "src/components/ui",
    EmptyState: "src/components/ui",
    Progress: "src/components/ui",
    Divider: "src/components/ui",
    colors: "src/components/ui",
    Typography: "src/components/ui",
  },

  // Layout Components
  layout: {
    Sidebar: "src/components/Sidebar",
    MainLayout: "src/components/Sidebar",
    Header: "src/components/Sidebar",
    Content: "src/components/Sidebar",
    StatsGrid: "src/components/Sidebar",
    getDefaultNavigation: "src/components/Sidebar",
  },

  // Chat Components
  chat: {
    EnhancedChatUI: "src/components/EnhancedChatUI",
  },

  // Showcase
  showcase: {
    ComponentShowcase: "src/components/ComponentShowcase",
  },
};

/**
 * Generate imports from component map
 */
function generateImports(category) {
  const components = componentMap[category];
  const imports = {};

  for (const [component, path] of Object.entries(components)) {
    if (!imports[path]) {
      imports[path] = [];
    }
    imports[path].push(component);
  }

  let output = "";
  for (const [path, components] of Object.entries(imports)) {
    output += `import { ${components.join(", ")} } from '@/${path}';\n`;
  }

  return output;
}

/**
 * Print all imports
 */
console.log("📦 COMPONENT IMPORT GENERATOR\n");

console.log("═══════════════════════════════════════════");
console.log("Base Components (src/components/ui)\n");
console.log(generateImports("base"));

console.log("\n═══════════════════════════════════════════");
console.log("Layout Components (src/components/Sidebar)\n");
console.log(generateImports("layout"));

console.log("\n═══════════════════════════════════════════");
console.log("Chat Components (src/components/EnhancedChatUI)\n");
console.log(generateImports("chat"));

console.log("\n═══════════════════════════════════════════");
console.log("Complete Setup (All Components)\n");
console.log(generateImports("base"));
console.log(generateImports("layout"));
console.log(generateImports("chat"));

console.log("\n═══════════════════════════════════════════");
console.log("Example Usage:\n");
console.log(`
// Option 1: Chat Only
import { EnhancedChatUI } from '@/components/EnhancedChatUI';

export function ChatPage() {
  return <EnhancedChatUI title="AI Assistant" />;
}

// Option 2: Dashboard Layout
import { MainLayout, Sidebar, Header, Content, getDefaultNavigation } from '@/components/Sidebar';
import { EnhancedChatUI } from '@/components/EnhancedChatUI';

export function Dashboard() {
  return (
    <MainLayout sidebar={<Sidebar sections={getDefaultNavigation()} />}>
      <Header title="Dashboard" />
      <Content>
        <EnhancedChatUI />
      </Content>
    </MainLayout>
  );
}

// Option 3: Use Base Components
import { Card, Button, Input, Badge } from '@/components/ui';

export function MyForm() {
  return (
    <Card>
      <Input placeholder="Name" />
      <Button>Submit</Button>
    </Card>
  );
}
`);

console.log("\n═══════════════════════════════════════════");
console.log("Lucide Icons Used:\n");

const icons = [
  "Send",
  "X",
  "ChevronDown",
  "Menu",
  "MessageSquare",
  "LogOut",
  "Settings",
  "Users",
  "BarChart3",
  "MessageCircle",
  "Loader2",
  "AlertCircle",
  "CheckCircle",
  "InfoIcon",
  "TrendingUp",
  "Target",
  "DollarSign",
  "Clock",
  "Archive",
  "Plus",
];

console.log("import {");
icons.forEach((icon, i) => {
  console.log(`  ${icon}${i < icons.length - 1 ? "," : ""}`);
});
console.log("} from 'lucide-react';\n");

console.log("═══════════════════════════════════════════");
console.log("Dependencies (all already installed):\n");
console.log("✅ react@19.2.0");
console.log("✅ react-dom@19.2.0");
console.log("✅ tailwindcss@4.0.6");
console.log("✅ lucide-react@0.544.0");
console.log("✅ react-markdown@10.1.0");
console.log("✅ remark-gfm@4.0.1\n");
