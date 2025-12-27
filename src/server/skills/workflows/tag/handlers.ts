/**
 * ContactTag Skill - CRUD Handlers
 *
 * Handlers for tag management using generic base classes.
 */

import {
  validateEntityData,
  getMissingFields,
  getNextRequiredField,
  createEntity,
  readEntity,
  updateEntity,
  deleteEntity,
  listEntity,
} from "@/server/skills/base";
import {
  CRUDResult,
  FieldMetadata,
} from "@/server/skills/workflows/contact/types";
import { IEntityRepository } from "@/server/skills/base";
import {
  TAG_FIELD_REGISTRY,
  TAG_REQUIRED_FIELD_NAMES,
  ContactTag,
} from "./types";

/**
 * Validate tag data using generic validator
 */
export const validateTagData = (
  data: unknown,
  operation: "create" | "update" = "update"
): CRUDResult<Record<string, any>> => {
  return validateEntityData(
    data,
    TAG_FIELD_REGISTRY,
    TAG_REQUIRED_FIELD_NAMES.map((k) => String(k)),
    ["id", "userId", "createdAt", "updatedAt"],
    operation
  );
};

/**
 * Create a new tag
 */
export async function createTag(
  repository: IEntityRepository<ContactTag>,
  data: unknown,
  userId: string
): Promise<CRUDResult<ContactTag>> {
  return createEntity(repository, data, userId, validateTagData);
}

/**
 * Read a single tag
 */
export async function readTag(
  repository: IEntityRepository<ContactTag>,
  id: string,
  userId: string,
  includeRelations: boolean = false
): Promise<CRUDResult<ContactTag>> {
  return readEntity(repository, id, userId, includeRelations);
}

/**
 * Update a tag
 */
export async function updateTag(
  repository: IEntityRepository<ContactTag>,
  id: string,
  userId: string,
  data: unknown
): Promise<CRUDResult<ContactTag>> {
  return updateEntity(repository, id, userId, data, validateTagData);
}

/**
 * Delete a tag
 */
export async function deleteTag(
  repository: IEntityRepository<ContactTag>,
  id: string,
  userId: string
): Promise<CRUDResult> {
  return deleteEntity(repository, id, userId);
}

/**
 * List tags for a user
 */
export async function listTags(
  repository: IEntityRepository<ContactTag>,
  userId: string,
  query?: string,
  page: number = 1,
  limit: number = 20
): Promise<CRUDResult<ContactTag[]>> {
  return listEntity(repository, userId, query, page, limit);
}

/**
 * Get missing required fields
 */
export function getMissingTagFields(
  data: Partial<ContactTag>
): FieldMetadata[] {
  return getMissingFields(
    data as Record<string, any>,
    TAG_REQUIRED_FIELD_NAMES.map((k) => String(k)),
    TAG_FIELD_REGISTRY
  );
}

/**
 * Get next required field
 */
export function getNextTagField(
  data: Partial<ContactTag>
): FieldMetadata | null {
  return getNextRequiredField(
    data as Record<string, any>,
    TAG_REQUIRED_FIELD_NAMES.map((k) => String(k)),
    TAG_FIELD_REGISTRY
  );
}
