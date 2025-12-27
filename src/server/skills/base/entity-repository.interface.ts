/**
 * Generic Entity Repository Interface
 *
 * Standardized interface for all entity repositories.
 * Enables generic CRUD handlers that work with any entity type.
 */

import { CRUDResult } from "@/server/skills/workflows/contact/types";

/**
 * Generic repository interface
 * All entity repositories should implement this
 */
export interface IEntityRepository<
  T = any,
  CreateInput = any,
  UpdateInput = any,
> {
  /**
   * Create a new entity
   */
  create(data: CreateInput): Promise<CRUDResult<T>>;

  /**
   * Find entity by ID
   */
  findById(
    id: string,
    userId: string,
    includeRelations?: boolean
  ): Promise<CRUDResult<T>>;

  /**
   * Find multiple entities with pagination
   */
  findMany(
    userId: string,
    page: number,
    limit: number
  ): Promise<CRUDResult<T[]>>;

  /**
   * Update entity by ID
   */
  update(id: string, userId: string, data: UpdateInput): Promise<CRUDResult<T>>;

  /**
   * Delete entity by ID
   */
  delete(id: string, userId: string): Promise<CRUDResult>;

  /**
   * Optional: Search entities
   */
  search?(
    userId: string,
    query: string,
    page: number,
    limit: number
  ): Promise<CRUDResult<T[]>>;

  /**
   * Optional: Count entities for user
   */
  countByUserId?(userId: string): Promise<number>;
}

/**
 * Repository methods that support searching
 */
export interface ISearchableRepository<T = any> extends IEntityRepository<T> {
  search(
    userId: string,
    query: string,
    page: number,
    limit: number
  ): Promise<CRUDResult<T[]>>;
}

/**
 * Check if repository supports searching
 */
export function isSearchable<T>(
  repo: IEntityRepository<T>
): repo is ISearchableRepository<T> {
  return "search" in repo && typeof (repo as any).search === "function";
}
