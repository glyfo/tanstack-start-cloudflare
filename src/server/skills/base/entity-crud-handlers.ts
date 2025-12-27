/**
 * Generic Entity CRUD Handlers
 *
 * Reusable CRUD operations for all entity types.
 * Uses repository interface for database abstraction.
 */

import { CRUDResult } from "@/server/skills/workflows/contact/types";
import { IEntityRepository, isSearchable } from "./entity-repository.interface";

/**
 * Generic create handler
 */
export async function createEntity<T>(
  repository: IEntityRepository<T>,
  data: unknown,
  userId: string,
  validator: (data: unknown) => CRUDResult<Record<string, any>>
): Promise<CRUDResult<T>> {
  const validation = validator(data);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error,
      errors: validation.errors,
    };
  }

  return repository.create({
    ...(validation.data || {}),
    userId,
  } as any);
}

/**
 * Generic read handler
 */
export async function readEntity<T>(
  repository: IEntityRepository<T>,
  id: string,
  userId: string,
  includeRelations: boolean = false
): Promise<CRUDResult<T>> {
  if (!id) {
    return { success: false, error: "ID is required" };
  }
  if (!userId) {
    return { success: false, error: "User ID is required" };
  }

  return repository.findById(id, userId, includeRelations);
}

/**
 * Generic update handler
 */
export async function updateEntity<T>(
  repository: IEntityRepository<T>,
  id: string,
  userId: string,
  data: unknown,
  validator: (data: unknown) => CRUDResult<Record<string, any>>
): Promise<CRUDResult<T>> {
  if (!id || !userId) {
    return {
      success: false,
      error: "ID and User ID are required",
    };
  }

  const validation = validator(data);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error,
      errors: validation.errors,
    };
  }

  return repository.update(id, userId, validation.data || {});
}

/**
 * Generic delete handler
 */
export async function deleteEntity<T>(
  repository: IEntityRepository<T>,
  id: string,
  userId: string
): Promise<CRUDResult> {
  if (!id || !userId) {
    return {
      success: false,
      error: "ID and User ID are required",
    };
  }

  return repository.delete(id, userId);
}

/**
 * Generic list handler with optional search
 */
export async function listEntity<T>(
  repository: IEntityRepository<T>,
  userId: string,
  query?: string,
  page: number = 1,
  limit: number = 20
): Promise<CRUDResult<T[]>> {
  if (!userId) {
    return { success: false, error: "User ID is required" };
  }

  if (query && isSearchable(repository)) {
    return repository.search(userId, query, page, limit);
  }

  return repository.findMany(userId, page, limit);
}
