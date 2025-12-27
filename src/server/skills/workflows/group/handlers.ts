/**
 * ContactGroup Skill - CRUD Handlers
 */

import { ContactGroup } from "@prisma/client";
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
  GROUP_FIELD_REGISTRY,
  GROUP_REQUIRED_FIELD_NAMES,
  GROUP_EDITABLE_FIELD_NAMES,
} from "./types";

export const validateGroupData = (
  data: unknown,
  operation: "create" | "update" = "update"
): CRUDResult<Record<string, any>> => {
  return validateEntityData(
    data,
    GROUP_FIELD_REGISTRY,
    GROUP_REQUIRED_FIELD_NAMES.map((k) => String(k)),
    ["id", "userId", "createdAt", "updatedAt"],
    operation
  );
};

export async function createGroup(
  repository: IEntityRepository<ContactGroup>,
  data: unknown,
  userId: string
): Promise<CRUDResult<ContactGroup>> {
  return createEntity(repository, data, userId, validateGroupData);
}

export async function readGroup(
  repository: IEntityRepository<ContactGroup>,
  id: string,
  userId: string
): Promise<CRUDResult<ContactGroup>> {
  return readEntity(repository, id, userId);
}

export async function updateGroup(
  repository: IEntityRepository<ContactGroup>,
  id: string,
  userId: string,
  data: unknown
): Promise<CRUDResult<ContactGroup>> {
  return updateEntity(repository, id, userId, data, validateGroupData);
}

export async function deleteGroup(
  repository: IEntityRepository<ContactGroup>,
  id: string,
  userId: string
): Promise<CRUDResult> {
  return deleteEntity(repository, id, userId);
}

export async function listGroups(
  repository: IEntityRepository<ContactGroup>,
  userId: string,
  query?: string,
  page: number = 1,
  limit: number = 20
): Promise<CRUDResult<ContactGroup[]>> {
  return listEntity(repository, userId, query, page, limit);
}

export function getMissingGroupFields(
  data: Partial<ContactGroup>
): FieldMetadata[] {
  return getMissingFields(
    data as Record<string, any>,
    GROUP_REQUIRED_FIELD_NAMES.map((k) => String(k)),
    GROUP_FIELD_REGISTRY
  );
}

export function getNextGroupField(
  data: Partial<ContactGroup>
): FieldMetadata | null {
  return getNextRequiredField(
    data as Record<string, any>,
    GROUP_REQUIRED_FIELD_NAMES.map((k) => String(k)),
    GROUP_FIELD_REGISTRY
  );
}
