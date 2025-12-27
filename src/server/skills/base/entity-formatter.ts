/**
 * Generic Entity Formatter
 *
 * Reusable formatting logic for all entity types.
 * Generates markdown and structured display from entities.
 */

import {
  FieldMetadata,
  FormattedContact,
  FormattedContactList,
} from "@/server/skills/workflows/contact/types";
import { EntityFieldRegistry } from "./entity-validator";

/**
 * Generic formatted entity type
 */
export interface FormattedEntity {
  title: string;
  fields: Array<{
    label: string;
    value: string;
    group: FieldMetadata["group"];
  }>;
  markdown: string;
  compact: string;
}

/**
 * Generic formatted list type
 */
export interface FormattedEntityList {
  title: string;
  items: Array<{
    id: string;
    display: string;
    preview: string;
  }>;
  total: number;
  page: number;
  hasMore: boolean;
  markdown: string;
}

/**
 * Format entity for detailed display
 * Works for any entity type with field registry
 */
export function formatEntityDetailed(
  entity: Record<string, any>,
  fieldRegistry: EntityFieldRegistry,
  systemFields: string[] = ["id", "userId", "createdAt", "updatedAt"],
  entityLabel: string = "Entity"
): FormattedEntity {
  const fields: FormattedEntity["fields"] = [];
  const groups: Record<string, typeof fields> = {};
  let markdown = `📋 **${entityLabel} Details**\n\n`;

  // Build fields and groups
  for (const [key, value] of Object.entries(entity)) {
    if (!value || systemFields.includes(key)) {
      continue;
    }

    const field = fieldRegistry[key];
    if (!field) continue;

    const fieldInfo = {
      label: field.label,
      value: String(value),
      group: field.group,
    };

    fields.push(fieldInfo);

    if (!groups[field.group]) {
      groups[field.group] = [];
    }
    groups[field.group].push(fieldInfo);
  }

  // Build markdown with grouping
  for (const [group, groupFields] of Object.entries(groups)) {
    if (groupFields.length === 0) continue;

    const groupTitle = group.charAt(0).toUpperCase() + group.slice(1);
    markdown += `### ${groupTitle}\n`;

    for (const field of groupFields) {
      markdown += `• **${field.label}:** ${field.value}\n`;
    }

    markdown += "\n";
  }

  // Compute compact representation
  const firstField = fields.length > 0 ? fields[0].value : entityLabel;
  const compact = firstField;

  return {
    fields,
    markdown,
    title: entityLabel,
    compact,
  };
}

/**
 * Format for confirmation display
 */
export function formatForEntityConfirmation(
  entity: Record<string, any>,
  fieldRegistry: EntityFieldRegistry,
  systemFields?: string[],
  entityLabel?: string
): string {
  const formatted = formatEntityDetailed(
    entity,
    fieldRegistry,
    systemFields,
    entityLabel
  );
  return (
    formatted.markdown +
    '\n**Is this correct?** Say "yes" to confirm or "no" to edit.\n'
  );
}

/**
 * Format single entity for simple display
 */
export function formatEntityForDisplay(
  entity: Record<string, any>,
  fieldRegistry: EntityFieldRegistry,
  systemFields: string[] = ["id", "userId", "createdAt", "updatedAt"]
): string {
  let msg = "📋 **Confirm Details:**\n\n";

  for (const [key, value] of Object.entries(entity)) {
    if (!value || systemFields.includes(key)) continue;

    const field = fieldRegistry[key];
    if (!field) continue;

    msg += `• **${field.label}:** ${value}\n`;
  }

  return msg;
}

/**
 * Format entity list for display
 */
export function formatEntityList(
  entities: Array<Record<string, any>>,
  displayFn: (entity: Record<string, any>) => string,
  previewFn: (entity: Record<string, any>) => string,
  total: number,
  page: number,
  limit: number,
  entityLabel: string = "Items"
): FormattedEntityList {
  const hasMore = page * limit < total;

  const items = entities.map((e) => ({
    id: e.id || "",
    display: displayFn(e),
    preview: previewFn(e),
  }));

  let markdown = `📇 **${entityLabel}** (${total} total)\n\n`;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    markdown += `${i + 1}. **${item.display}**\n   ${item.preview}\n\n`;
  }

  if (hasMore) {
    markdown += `... and ${total - page * limit} more\n`;
  }

  return {
    title: `${entityLabel} (${page * limit} of ${total})`,
    items,
    total,
    page,
    hasMore,
    markdown,
  };
}
