/**
 * Common Formatters Utility
 *
 * Centralized formatting functions for consistent output across all skills
 * Eliminates inconsistent formatting across Entity skills
 * 100% reusable across Account, Product, Order, Pipeline, Opportunity, etc.
 *
 * FEATURES:
 * - Currency formatting
 * - Date formatting (multiple formats)
 * - Percentage formatting
 * - List formatting
 * - Summary formatting (truncation)
 * - Response message formatting
 *
 * USAGE:
 * import { CommonFormatters } from '@/server/utils/formatters';
 * CommonFormatters.currency(1500, 'USD'); // '$1,500.00'
 * CommonFormatters.date(new Date()); // 'Dec 26, 2025'
 */

export class CommonFormatters {
  /**
   * Format currency with symbol
   */
  static currency(
    value: number | undefined | null,
    currency: string = "USD"
  ): string {
    if (value === undefined || value === null) return "-";

    const symbols: Record<string, string> = {
      USD: "$",
      EUR: "€",
      GBP: "£",
      JPY: "¥",
      CAD: "C$",
      AUD: "A$",
    };

    const symbol = symbols[currency] || currency;
    return `${symbol}${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  /**
   * Format date to readable string
   */
  static date(
    value: Date | string | undefined | null,
    format: "short" | "long" | "iso" = "short"
  ): string {
    if (!value) return "-";

    const date = typeof value === "string" ? new Date(value) : value;
    if (!(date instanceof Date) || isNaN(date.getTime())) return "-";

    switch (format) {
      case "short":
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      case "long":
        return date.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        });
      case "iso":
        return date.toISOString().split("T")[0];
      default:
        return date.toLocaleDateString();
    }
  }

  /**
   * Format percentage with % symbol
   */
  static percentage(
    value: number | undefined | null,
    decimals: number = 0
  ): string {
    if (value === undefined || value === null) return "-";
    return `${value.toFixed(decimals)}%`;
  }

  /**
   * Format array as readable list
   */
  static list(
    items: string[] | undefined | null,
    separator: string = ", "
  ): string {
    if (!items || items.length === 0) return "None";
    if (items.length === 1) return items[0];

    const allButLast = items.slice(0, -1);
    const last = items[items.length - 1];
    return `${allButLast.join(separator)}${separator}and ${last}`;
  }

  /**
   * Format object as summary (one-liner)
   */
  static summary(
    obj: Record<string, any> | undefined | null,
    maxLength: number = 100
  ): string {
    if (!obj) return "-";

    const entries = Object.entries(obj)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${v}`);

    const summary = entries.join(" | ");
    return summary.length > maxLength
      ? summary.substring(0, maxLength) + "..."
      : summary;
  }

  /**
   * Format confirmation message
   */
  static confirmation(
    action: string,
    entity: string,
    details?: Record<string, any>
  ): string {
    const message = `Ready to ${action} ${entity}`;

    if (details && Object.keys(details).length > 0) {
      const detailsStr = this.summary(details);
      return `${message}: ${detailsStr}`;
    }

    return message;
  }

  /**
   * Format success message
   */
  static success(action: string, entity: string, id?: string): string {
    if (id) {
      return `✅ ${entity} ${action} successfully (ID: ${id})`;
    }
    return `✅ ${entity} ${action} successfully`;
  }

  /**
   * Format error message
   */
  static error(action: string, entity: string, reason?: string): string {
    if (reason) {
      return `❌ Failed to ${action} ${entity}: ${reason}`;
    }
    return `❌ Failed to ${action} ${entity}`;
  }

  /**
   * Format phone number (humanized)
   */
  static phone(value: string | undefined | null): string {
    if (!value) return "-";

    const digits = value.replace(/\D/g, "");

    // US format: (123) 456-7890
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }

    // International: +1-123-456-7890
    if (digits.length === 11 && digits.startsWith("1")) {
      return `+1-${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
    }

    return value;
  }

  /**
   * Format name with capitalization
   */
  static name(
    value: string | undefined | null,
    style: "capitalize" | "uppercase" | "lowercase" = "capitalize"
  ): string {
    if (!value) return "-";

    switch (style) {
      case "capitalize":
        return value
          .split(" ")
          .map(
            (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          )
          .join(" ");
      case "uppercase":
        return value.toUpperCase();
      case "lowercase":
        return value.toLowerCase();
      default:
        return value;
    }
  }

  /**
   * Format duration (milliseconds to human-readable)
   */
  static duration(ms: number | undefined | null): string {
    if (!ms) return "-";

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Format bytes to human-readable size
   */
  static fileSize(bytes: number | undefined | null): string {
    if (!bytes) return "-";

    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Format as badge/tag
   */
  static badge(
    value: string | undefined | null,
    style: "primary" | "success" | "warning" | "danger" = "primary"
  ): string {
    if (!value) return "-";

    const styles: Record<string, { prefix: string; suffix: string }> = {
      primary: { prefix: "🔵", suffix: "" },
      success: { prefix: "🟢", suffix: "" },
      warning: { prefix: "🟡", suffix: "" },
      danger: { prefix: "🔴", suffix: "" },
    };

    const { prefix, suffix } = styles[style];
    return `${prefix} ${value}${suffix ? ` ${suffix}` : ""}`;
  }

  /**
   * Truncate text with ellipsis
   */
  static truncate(
    value: string | undefined | null,
    length: number = 50
  ): string {
    if (!value) return "-";
    return value.length > length ? value.substring(0, length) + "..." : value;
  }

  /**
   * Format boolean as yes/no
   */
  static boolean(value: boolean | undefined | null): string {
    if (value === undefined || value === null) return "-";
    return value ? "Yes" : "No";
  }

  /**
   * Format number with thousand separators
   */
  static number(
    value: number | undefined | null,
    decimals: number = 0
  ): string {
    if (value === undefined || value === null) return "-";
    return value.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
}
