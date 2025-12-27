/**
 * Interaction Skill - CRUD Handlers
 */

import { Interaction } from "@prisma/client";
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
  INTERACTION_FIELD_REGISTRY,
  INTERACTION_REQUIRED_FIELD_NAMES,
} from "./types";

export const validateInteractionData = (
  data: unknown,
  operation: "create" | "update" = "update"
): CRUDResult<Record<string, any>> => {
  return validateEntityData(
    data,
    INTERACTION_FIELD_REGISTRY,
    INTERACTION_REQUIRED_FIELD_NAMES.map((k) => String(k)),
    ["id", "userId", "createdAt", "updatedAt"],
    operation
  );
};

export async function createInteraction(
  repository: IEntityRepository<Interaction>,
  data: unknown,
  userId: string
): Promise<CRUDResult<Interaction>> {
  return createEntity(repository, data, userId, validateInteractionData);
}

export async function readInteraction(
  repository: IEntityRepository<Interaction>,
  id: string,
  userId: string
): Promise<CRUDResult<Interaction>> {
  return readEntity(repository, id, userId);
}

export async function updateInteraction(
  repository: IEntityRepository<Interaction>,
  id: string,
  userId: string,
  data: unknown
): Promise<CRUDResult<Interaction>> {
  return updateEntity(repository, id, userId, data, validateInteractionData);
}

export async function deleteInteraction(
  repository: IEntityRepository<Interaction>,
  id: string,
  userId: string
): Promise<CRUDResult> {
  return deleteEntity(repository, id, userId);
}

export async function listInteractions(
  repository: IEntityRepository<Interaction>,
  userId: string,
  query?: string,
  page: number = 1,
  limit: number = 50
): Promise<CRUDResult<Interaction[]>> {
  return listEntity(repository, userId, query, page, limit);
}

export function getMissingInteractionFields(
  data: Partial<Interaction>
): FieldMetadata[] {
  return getMissingFields(
    data as Record<string, any>,
    INTERACTION_REQUIRED_FIELD_NAMES.map((k) => String(k)),
    INTERACTION_FIELD_REGISTRY
  );
}

export function getNextInteractionField(
  data: Partial<Interaction>
): FieldMetadata | null {
  return getNextRequiredField(
    data as Record<string, any>,
    INTERACTION_REQUIRED_FIELD_NAMES.map((k) => String(k)),
    INTERACTION_FIELD_REGISTRY
  );
}
