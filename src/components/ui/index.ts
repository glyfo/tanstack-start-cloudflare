/**
 * Enhanced UI Components Library
 * Based on shadcn/ui design system patterns
 * Clean, minimal light-only aesthetic
 * 
 * Features:
 * - Clean, minimal design
 * - Light theme optimized
 * - Proper spacing and typography
 * - Accessible components
 * - Consistent color system
 */

import React from "react";
import { cn } from "@/lib/utils";

// ============================================
// COLOR & THEME SYSTEM
// ============================================

export const colors = {
  // Neutrals
  background: "bg-white",
  surface: "bg-slate-50",
  border: "border-slate-200",
  text: {
    primary: "text-slate-900",
    secondary: "text-slate-600",
    muted: "text-slate-500",
  },

  // Semantic
  success: "bg-green-50 text-green-900",
  warning: "bg-amber-50 text-amber-900",
  error: "bg-red-50 text-red-900",
  info: "bg-blue-50 text-blue-900",

  // Accent
  primary: "bg-blue-600 hover:bg-blue-700",
  secondary: "bg-slate-200 hover:bg-slate-300",
};

// ============================================
// TYPOGRAPHY
// ============================================

export const Typography = {
  H1: "text-4xl font-bold tracking-tight text-slate-900",
  H2: "text-3xl font-semibold tracking-tight text-slate-900",
  H3: "text-2xl font-semibold text-slate-900",
  H4: "text-xl font-semibold text-slate-900",
  H5: "text-lg font-medium text-slate-900",
  P: "text-base leading-relaxed text-slate-700",
  Small: "text-sm text-slate-600",
  Code: "font-mono text-sm bg-slate-100 px-2 py-1 rounded text-slate-900",
};

// ============================================
// CARD COMPONENT
// ============================================

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "outlined";
  hover?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", hover = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg bg-white",
        variant === "elevated" && "shadow-lg",
        variant === "outlined" && "border border-slate-200",
        variant === "default" && "shadow-sm border border-slate-200",
        hover && "transition-shadow hover:shadow-md",
        "p-6",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

// ============================================
// BUTTON COMPONENT
// ============================================

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, children, disabled, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
      primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
      secondary: "bg-slate-200 text-slate-900 hover:bg-slate-300 focus:ring-slate-500",
      ghost: "text-slate-900 hover:bg-slate-100 focus:ring-slate-500",
      destructive: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    };

    const sizes = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2 text-base",
      lg: "px-6 py-3 text-lg",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg className="animate-spin -ml-1 mr-3 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

// ============================================
// INPUT COMPONENT
// ============================================

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => (
    <div className="w-full">
      <input
        ref={ref}
        className={cn(
          "w-full px-4 py-2 bg-white border border-slate-200 rounded-lg",
          "text-slate-900 placeholder-slate-500",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
          "transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          error && "border-red-500 focus:ring-red-500",
          className
        )}
        {...props}
      />
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  )
);
Input.displayName = "Input";

// ============================================
// TEXTAREA COMPONENT
// ============================================

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <div className="w-full">
      <textarea
        ref={ref}
        className={cn(
          "w-full px-4 py-3 bg-white border border-slate-200 rounded-lg",
          "text-slate-900 placeholder-slate-500",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
          "transition-colors disabled:opacity-50 disabled:cursor-not-allowed resize-none",
          error && "border-red-500 focus:ring-red-500",
          className
        )}
        {...props}
      />
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  )
);
Textarea.displayName = "Textarea";

// ============================================
// BADGE COMPONENT
// ============================================

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "error" | "info";
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const variants = {
      default: "bg-slate-100 text-slate-900",
      success: "bg-green-100 text-green-800",
      warning: "bg-amber-100 text-amber-800",
      error: "bg-red-100 text-red-800",
      info: "bg-blue-100 text-blue-800",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

// ============================================
// ALERT COMPONENT
// ============================================

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "error" | "info";
  icon?: React.ReactNode;
  title?: string;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", icon, title, children, ...props }, ref) => {
    const variants = {
      default: "bg-slate-50 border-slate-200 text-slate-900",
      success: "bg-green-50 border-green-200 text-green-900",
      warning: "bg-amber-50 border-amber-200 text-amber-900",
      error: "bg-red-50 border-red-200 text-red-900",
      info: "bg-blue-50 border-blue-200 text-blue-900",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border p-4 flex gap-3",
          variants[variant],
          className
        )}
        {...props}
      >
        {icon && <div className="flex-shrink-0">{icon}</div>}
        <div className="flex-1">
          {title && <h4 className="font-semibold mb-1">{title}</h4>}
          {children}
        </div>
      </div>
    );
  }
);
Alert.displayName = "Alert";

// ============================================
// SEPARATOR COMPONENT
// ============================================

export const Separator = React.forwardRef<
  HTML DivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "shrink-0 bg-slate-200",
      className
    )}
    {...props}
  />
));
Separator.displayName = "Separator";

// ============================================
// LOADING SKELETON
// ============================================

export const Skeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "animate-pulse rounded-lg bg-slate-200",
      className
    )}
    {...props}
  />
);

// ============================================
// STATUS INDICATOR
// ============================================

interface StatusIndicatorProps {
  status: "online" | "offline" | "away" | "busy";
}

export const StatusIndicator = ({ status }: StatusIndicatorProps) => {
  const colors = {
    online: "bg-green-500",
    offline: "bg-slate-400",
    away: "bg-amber-500",
    busy: "bg-red-500",
  };

  return (
    <div className="flex items-center gap-2">
      <div className={cn("w-2 h-2 rounded-full", colors[status])} />
      <span className="text-sm capitalize text-slate-600">{status}</span>
    </div>
  );
};

// ============================================
// STAT CARD
// ============================================

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: number;
  icon?: React.ReactNode;
}

export const StatCard = ({ label, value, trend, icon }: StatCardProps) => (
  <Card className="relative overflow-hidden">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className={cn(Typography.Small, "mb-2")}>{label}</p>
        <p className={cn(Typography.H4)}>{value}</p>
        {trend !== undefined && (
          <p className={cn(Typography.Small, "mt-2", trend > 0 ? "text-green-600" : "text-red-600")}>
            {trend > 0 ? "+" : ""}{trend}% from last period
          </p>
        )}
      </div>
      {icon && <div className="text-slate-400">{icon}</div>}
    </div>
  </Card>
);

// ============================================
// DIVIDER
// ============================================

export const Divider = ({ children }: { children?: React.ReactNode }) => (
  <div className="flex items-center gap-4 my-4">
    <div className="flex-1 h-px bg-slate-200" />
    {children && <span className={cn(Typography.Small)}>{children}</span>}
    <div className="flex-1 h-px bg-slate-200" />
  </div>
);

// ============================================
// EMPTY STATE
// ============================================

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
    {icon && <div className="text-4xl mb-4 text-slate-400">{icon}</div>}
    <h3 className={cn(Typography.H4, "mb-2")}>{title}</h3>
    {description && <p className={cn(Typography.Small, "mb-6 max-w-sm")}>{description}</p>}
    {action && <div>{action}</div>}
  </div>
);

// ============================================
// PROGRESS BAR
// ============================================

interface ProgressProps {
  value: number;
  max?: number;
  label?: string;
  showLabel?: boolean;
}

export const Progress = ({ value, max = 100, label, showLabel = true }: ProgressProps) => {
  const percentage = (value / max) * 100;

  return (
    <div className="w-full">
      {(label || showLabel) && (
        <div className="flex items-center justify-between mb-2">
          <span className={cn(Typography.Small)}>{label || `${Math.round(percentage)}%`}</span>
          <span className={cn(Typography.Small, colors.text.muted)}>{value}/{max}</span>
        </div>
      )}
      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// ============================================
// UTILITY FUNCTION FOR CLASSNAMES
// ============================================

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}
