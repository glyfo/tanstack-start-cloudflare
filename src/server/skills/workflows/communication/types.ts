/**
 * Communication Skill - Types
 */

import { Communication } from "@prisma/client";
import { FieldMetadata } from "@/server/skills/workflows/contact/types";

export const COMMUNICATION_FIELD_REGISTRY: Record<
  keyof Communication,
  FieldMetadata
> = {
  id: {
    name: "id",
    label: "Communication ID",
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
    label: "Communication Type",
    type: "select",
    required: true,
    group: "basic",
    enum: ["email", "phone", "sms", "linkedin", "whatsapp"],
  },
  direction: {
    name: "direction",
    label: "Direction",
    type: "select",
    required: true,
    group: "basic",
    enum: ["inbound", "outbound"],
  },
  content: {
    name: "content",
    label: "Content",
    type: "textarea",
    required: false,
    group: "basic",
    maxLength: 2000,
  },
  subject: {
    name: "subject",
    label: "Subject",
    type: "text",
    required: false,
    group: "basic",
    maxLength: 200,
  },
  status: {
    name: "status",
    label: "Status",
    type: "select",
    required: false,
    group: "basic",
    enum: ["pending", "sent", "received", "failed", "archived"],
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
};

export const COMMUNICATION_REQUIRED_FIELD_NAMES: (keyof Communication)[] = [
  "contactId",
  "type",
  "direction",
  "userId",
];
export const COMMUNICATION_EDITABLE_FIELD_NAMES: (keyof Communication)[] = [
  "type",
  "direction",
  "content",
  "subject",
  "status",
];
