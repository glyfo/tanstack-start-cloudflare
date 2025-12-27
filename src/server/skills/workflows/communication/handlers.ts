/**
 * Communication Skill - CRUD Handlers
 */

import { Communication } from "@prisma/client";
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
  COMMUNICATION_FIELD_REGISTRY,
  COMMUNICATION_REQUIRED_FIELD_NAMES,
} from "./types";

export const validateCommunicationData = (
  data: unknown,
  operation: "create" | "update" = "update"
): CRUDResult<Record<string, any>> => {
  return validateEntityData(
    data,
    COMMUNICATION_FIELD_REGISTRY,
    COMMUNICATION_REQUIRED_FIELD_NAMES.map((k) => String(k)),
    ["id", "userId", "createdAt"],
    operation
  );
};

export async function createCommunication(
  repository: IEntityRepository<Communication>,
  data: unknown,
  userId: string
): Promise<CRUDResult<Communication>> {
  return createEntity(repository, data, userId, validateCommunicationData);
}

export async function readCommunication(
  repository: IEntityRepository<Communication>,
  id: string,
  userId: string
): Promise<CRUDResult<Communication>> {
  return readEntity(repository, id, userId);
}

export async function updateCommunication(
  repository: IEntityRepository<Communication>,
  id: string,
  userId: string,
  data: unknown
): Promise<CRUDResult<Communication>> {
  return updateEntity(repository, id, userId, data, validateCommunicationData);
}

export async function deleteCommunication(
  repository: IEntityRepository<Communication>,
  id: string,
  userId: string
): Promise<CRUDResult> {
  return deleteEntity(repository, id, userId);
}

export async function listCommunications(
  repository: IEntityRepository<Communication>,
  userId: string,
  query?: string,
  page: number = 1,
  limit: number = 50
): Promise<CRUDResult<Communication[]>> {
  return listEntity(repository, userId, query, page, limit);
}

export function getMissingCommunicationFields(
  data: Partial<Communication>
): FieldMetadata[] {
  return getMissingFields(
    data as Record<string, any>,
    COMMUNICATION_REQUIRED_FIELD_NAMES.map((k) => String(k)),
    COMMUNICATION_FIELD_REGISTRY
  );
}

export function getNextCommunicationField(
  data: Partial<Communication>
): FieldMetadata | null {
  return getNextRequiredField(
    data as Record<string, any>,
    COMMUNICATION_REQUIRED_FIELD_NAMES.map((k) => String(k)),
    COMMUNICATION_FIELD_REGISTRY
  );
}
