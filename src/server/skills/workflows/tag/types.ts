/**
 * ContactTag Skill - Types
 *
 * Defines types, field metadata, and constants for Contact Tags.
 */

import { FieldMetadata } from "@/server/skills/workflows/contact/types";

/**
 * ContactTag type based on Prisma schema
 */
export interface ContactTag {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Field registry for ContactTag
 */
export const TAG_FIELD_REGISTRY: Record<keyof ContactTag, FieldMetadata> = {
  id: {
    name: "id",
    label: "Tag ID",
    type: "text",
    required: false,
    group: "custom",
    placeholder: "auto-generated",
  },
  name: {
    name: "name",
    label: "Tag Name",
    type: "text",
    required: true,
    group: "basic",
    placeholder: "e.g., VIP, Hot Lead",
    minLength: 1,
    maxLength: 50,
  },
  color: {
    name: "color",
    label: "Tag Color",
    type: "text",
    required: false,
    group: "basic",
    placeholder: "#FF5733",
    pattern: "^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$",
  },
  description: {
    name: "description",
    label: "Description",
    type: "textarea",
    required: false,
    group: "basic",
    placeholder: "e.g., High-value customers",
    maxLength: 200,
  },
  userId: {
    name: "userId",
    label: "User ID",
    type: "text",
    required: true,
    group: "custom",
  },
  createdAt: {
    name: "createdAt",
    label: "Created",
    type: "date",
    required: false,
    group: "custom",
  },
  updatedAt: {
    name: "updatedAt",
    label: "Updated",
    type: "date",
    required: false,
    group: "custom",
  },
};

/**
 * Required field names for tag creation
 */
export const TAG_REQUIRED_FIELD_NAMES: (keyof ContactTag)[] = [
  "name",
  "userId",
];

/**
 * Editable field names (excludes system fields)
 */
export const TAG_EDITABLE_FIELD_NAMES: (keyof ContactTag)[] = [
  "name",
  "color",
  "description",
];
