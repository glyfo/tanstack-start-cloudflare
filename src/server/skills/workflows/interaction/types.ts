/**
 * Interaction Skill - Types
 */

import { Interaction } from "@prisma/client";
import { FieldMetadata } from "@/server/skills/workflows/contact/types";

export const INTERACTION_FIELD_REGISTRY: Record<
  keyof Interaction,
  FieldMetadata
> = {
  id: {
    name: "id",
    label: "Interaction ID",
    type: "text",
    required: false,
    group: "custom",
  },
  contactId: {
    name: "contactId",
    label: "Contact ID",
    type: "text",
    required: true,
    group: "basic",
  },
  type: {
    name: "type",
    label: "Interaction Type",
    type: "select",
    required: true,
    group: "basic",
    enum: ["call", "email", "meeting", "note", "task"],
  },
  title: {
    name: "title",
    label: "Title",
    type: "text",
    required: true,
    group: "basic",
    minLength: 1,
    maxLength: 200,
  },
  notes: {
    name: "notes",
    label: "Notes",
    type: "textarea",
    required: false,
    group: "basic",
    maxLength: 1000,
  },
  duration: {
    name: "duration",
    label: "Duration (minutes)",
    type: "number",
    required: false,
    group: "basic",
  },
  date: {
    name: "date",
    label: "Date",
    type: "date",
    required: true,
    group: "basic",
  },
  outcome: {
    name: "outcome",
    label: "Outcome",
    type: "text",
    required: false,
    group: "basic",
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

export const INTERACTION_REQUIRED_FIELD_NAMES: (keyof Interaction)[] = [
  "contactId",
  "type",
  "title",
  "date",
  "userId",
];
export const INTERACTION_EDITABLE_FIELD_NAMES: (keyof Interaction)[] = [
  "type",
  "title",
  "notes",
  "duration",
  "date",
  "outcome",
];
