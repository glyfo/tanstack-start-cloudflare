/**
 * ContactGroup Skill - Types
 */

import { ContactGroup } from "@prisma/client";
import { FieldMetadata } from "@/server/skills/workflows/contact/types";

export const GROUP_FIELD_REGISTRY: Record<keyof ContactGroup, FieldMetadata> = {
  id: {
    name: "id",
    label: "Group ID",
    type: "text",
    required: false,
    group: "custom",
  },
  name: {
    name: "name",
    label: "Group Name",
    type: "text",
    required: true,
    group: "basic",
    placeholder: "e.g., Premium Clients",
    minLength: 1,
    maxLength: 100,
  },
  description: {
    name: "description",
    label: "Description",
    type: "textarea",
    required: false,
    group: "basic",
    maxLength: 500,
  },
  icon: {
    name: "icon",
    label: "Icon",
    type: "text",
    required: false,
    group: "basic",
    placeholder: "⭐",
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

export const GROUP_REQUIRED_FIELD_NAMES: (keyof ContactGroup)[] = [
  "name",
  "userId",
];
export const GROUP_EDITABLE_FIELD_NAMES: (keyof ContactGroup)[] = [
  "name",
  "description",
  "icon",
];
