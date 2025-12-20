import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { Entity, Relation } from "./types.js";
import { validationLogger } from "./logger.js";

/**
 * Input size limits to prevent DoS attacks via oversized payloads.
 * These limits are based on reasonable maximum sizes for semantic code memory operations.
 */
export const INPUT_LIMITS = {
  /** Maximum length of a search query string */
  QUERY_MAX_LENGTH: 10000,
  /** Maximum number of entities in a single create request */
  ENTITIES_MAX_COUNT: 1000,
  /** Maximum length of an entity name */
  ENTITY_NAME_MAX_LENGTH: 500,
  /** Maximum number of observations per entity */
  OBSERVATIONS_MAX_COUNT: 100,
  /** Maximum length of a single observation */
  OBSERVATION_MAX_LENGTH: 50000,
  /** Maximum number of relations in a single create request */
  RELATIONS_MAX_COUNT: 1000,
  /** Maximum number of entity names in a delete request */
  ENTITY_NAMES_MAX_COUNT: 1000,
} as const;

export interface CreateEntitiesRequest {
  entities: Entity[];
  collection?: string;
}

export interface CreateRelationsRequest {
  relations: Relation[];
  collection?: string;
}

export interface AddObservationsRequest {
  observations: Array<{
    entityName: string;
    contents: string[];
  }>;
  collection?: string;
}

export interface DeleteEntitiesRequest {
  entityNames: string[];
  collection?: string;
}

export interface DeleteObservationsRequest {
  deletions: Array<{
    entityName: string;
    observations: string[];
  }>;
  collection?: string;
}

export interface DeleteRelationsRequest {
  relations: Relation[];
  collection?: string;
}

export interface SearchSimilarRequest {
  query: string;
  limit?: number;
  entityTypes?: string[];
  searchMode?: "semantic" | "keyword" | "hybrid";
  collection?: string;
}

export interface GetImplementationRequest {
  entityName: string;
  scope?: "minimal" | "logical" | "dependencies";
  collection?: string;
}

export interface ReadGraphRequest {
  mode?: "smart" | "entities" | "relationships" | "raw";
  limit?: number;
  entityTypes?: string[];
  entity?: string;
  collection?: string;
  /** Filter out test/mock code entities. Default: true (backward compatible, includes tests) */
  includeTests?: boolean;
  /** Minimum relevance score threshold (0.0-1.0). Entities/relations below this score are filtered. Default: 0.0 */
  minRelevance?: number;
}

export interface SearchDocsRequest {
  query: string;
  docTypes?: ("prd" | "tdd" | "adr" | "spec")[];
  limit?: number;
  collection?: string;
}

export interface GetDocRequest {
  docId: string;
  section?: string;
  collection?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isEntity(value: unknown): value is Entity {
  if (!isRecord(value)) return false;

  // Support both entityType (camelCase) and entity_type (snake_case)
  const entityType = (value as any).entityType || (value as any).entity_type;

  const nameOk = typeof (value as any).name === "string";
  const typeOk = typeof entityType === "string";
  const obsOk =
    Array.isArray((value as any).observations) &&
    (value as any).observations.every((obs: any) => typeof obs === "string");

  return nameOk && typeOk && obsOk;
}

function isRelation(value: unknown): value is Relation {
  if (!isRecord(value)) return false;
  return (
    typeof value.from === "string" &&
    typeof value.to === "string" &&
    typeof value.relationType === "string"
  );
}

export function validateCreateEntitiesRequest(args: unknown): CreateEntitiesRequest {
  if (!isRecord(args)) {
    validationLogger.debug("Invalid request format - not a record", { type: typeof args });
    throw new McpError(ErrorCode.InvalidParams, "Invalid request format");
  }

  const { entities, collection } = args;
  if (!Array.isArray(entities)) {
    validationLogger.debug("entities is not an array", { type: typeof entities });
    throw new McpError(ErrorCode.InvalidParams, "Invalid entities array");
  }

  // Input size validation: check entity count
  if (entities.length > INPUT_LIMITS.ENTITIES_MAX_COUNT) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Entities array exceeds maximum of ${INPUT_LIMITS.ENTITIES_MAX_COUNT} items (received ${entities.length})`
    );
  }

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    if (!isEntity(entity)) {
      validationLogger.debug("Entity validation failed", {
        index: i,
        nameType: typeof entity?.name,
        entityType: entity?.entityType,
        entity_type: entity?.entity_type,
        hasObservations: Array.isArray(entity?.observations),
      });
      throw new McpError(ErrorCode.InvalidParams, `Invalid entity at index ${i}`);
    }

    // Input size validation: check entity name length
    if (entity.name.length > INPUT_LIMITS.ENTITY_NAME_MAX_LENGTH) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Entity name at index ${i} exceeds maximum of ${INPUT_LIMITS.ENTITY_NAME_MAX_LENGTH} characters`
      );
    }

    // Input size validation: check observations count and length
    if (entity.observations.length > INPUT_LIMITS.OBSERVATIONS_MAX_COUNT) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Entity at index ${i} has too many observations (max ${INPUT_LIMITS.OBSERVATIONS_MAX_COUNT})`
      );
    }

    for (let j = 0; j < entity.observations.length; j++) {
      if (entity.observations[j].length > INPUT_LIMITS.OBSERVATION_MAX_LENGTH) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Observation ${j} in entity ${i} exceeds maximum of ${INPUT_LIMITS.OBSERVATION_MAX_LENGTH} characters`
        );
      }
    }
  }

  if (collection !== undefined && typeof collection !== "string") {
    throw new McpError(ErrorCode.InvalidParams, "collection must be a string");
  }

  return { entities, collection: collection };
}

export function validateCreateRelationsRequest(args: unknown): CreateRelationsRequest {
  if (!isRecord(args)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid request format");
  }

  const { relations, collection } = args;
  if (!Array.isArray(relations) || !relations.every(isRelation)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid relations array");
  }

  // Input size validation: check relations count
  if (relations.length > INPUT_LIMITS.RELATIONS_MAX_COUNT) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Relations array exceeds maximum of ${INPUT_LIMITS.RELATIONS_MAX_COUNT} items (received ${relations.length})`
    );
  }

  if (collection !== undefined && typeof collection !== "string") {
    throw new McpError(ErrorCode.InvalidParams, "collection must be a string");
  }

  return { relations, collection: collection };
}

export function validateAddObservationsRequest(args: unknown): AddObservationsRequest {
  if (!isRecord(args)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid request format");
  }

  const { observations, collection } = args;
  if (!Array.isArray(observations)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid observations array");
  }

  for (let i = 0; i < observations.length; i++) {
    const obs = observations[i];
    if (!isRecord(obs) || typeof obs.entityName !== "string" || !isStringArray(obs.contents)) {
      throw new McpError(ErrorCode.InvalidParams, "Invalid observation format");
    }

    // Input size validation: check entity name length
    if (obs.entityName.length > INPUT_LIMITS.ENTITY_NAME_MAX_LENGTH) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Entity name at index ${i} exceeds maximum of ${INPUT_LIMITS.ENTITY_NAME_MAX_LENGTH} characters`
      );
    }

    // Input size validation: check observations count
    const contents = obs.contents;
    if (contents.length > INPUT_LIMITS.OBSERVATIONS_MAX_COUNT) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Observation at index ${i} has too many contents (max ${INPUT_LIMITS.OBSERVATIONS_MAX_COUNT})`
      );
    }

    // Input size validation: check each observation content length
    for (let j = 0; j < contents.length; j++) {
      if (contents[j].length > INPUT_LIMITS.OBSERVATION_MAX_LENGTH) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Content ${j} in observation ${i} exceeds maximum of ${INPUT_LIMITS.OBSERVATION_MAX_LENGTH} characters`
        );
      }
    }
  }

  if (collection !== undefined && typeof collection !== "string") {
    throw new McpError(ErrorCode.InvalidParams, "collection must be a string");
  }

  return {
    observations: observations as AddObservationsRequest["observations"],
    collection: collection,
  };
}

export function validateDeleteEntitiesRequest(args: unknown): DeleteEntitiesRequest {
  if (!isRecord(args)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid request format");
  }

  const { entityNames, collection } = args;
  if (!isStringArray(entityNames)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid entityNames array");
  }

  // Input size validation: check entity names count
  if (entityNames.length > INPUT_LIMITS.ENTITY_NAMES_MAX_COUNT) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Entity names array exceeds maximum of ${INPUT_LIMITS.ENTITY_NAMES_MAX_COUNT} items (received ${entityNames.length})`
    );
  }

  if (collection !== undefined && typeof collection !== "string") {
    throw new McpError(ErrorCode.InvalidParams, "collection must be a string");
  }

  return { entityNames, collection: collection };
}

export function validateDeleteObservationsRequest(args: unknown): DeleteObservationsRequest {
  if (!isRecord(args)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid request format");
  }

  const { deletions, collection } = args;
  if (!Array.isArray(deletions)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid deletions array");
  }

  for (const del of deletions) {
    if (!isRecord(del) || typeof del.entityName !== "string" || !isStringArray(del.observations)) {
      throw new McpError(ErrorCode.InvalidParams, "Invalid deletion format");
    }
  }

  if (collection !== undefined && typeof collection !== "string") {
    throw new McpError(ErrorCode.InvalidParams, "collection must be a string");
  }

  return {
    deletions: deletions as DeleteObservationsRequest["deletions"],
    collection: collection,
  };
}

export function validateDeleteRelationsRequest(args: unknown): DeleteRelationsRequest {
  if (!isRecord(args)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid request format");
  }

  const { relations, collection } = args;
  if (!Array.isArray(relations) || !relations.every(isRelation)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid relations array");
  }

  if (collection !== undefined && typeof collection !== "string") {
    throw new McpError(ErrorCode.InvalidParams, "collection must be a string");
  }

  return { relations, collection: collection };
}

export function validateSearchSimilarRequest(args: unknown): SearchSimilarRequest {
  if (!isRecord(args)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid request format");
  }

  const { query, entityTypes, limit, searchMode } = args;
  if (typeof query !== "string") {
    throw new McpError(ErrorCode.InvalidParams, "Missing or invalid query string");
  }

  // Input size validation: check query length
  if (query.length > INPUT_LIMITS.QUERY_MAX_LENGTH) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Query exceeds maximum length of ${INPUT_LIMITS.QUERY_MAX_LENGTH} characters (received ${query.length})`
    );
  }

  if (limit !== undefined && (typeof limit !== "number" || limit <= 0)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid limit value");
  }

  if (entityTypes !== undefined) {
    if (!Array.isArray(entityTypes) || !entityTypes.every((t) => typeof t === "string")) {
      throw new McpError(ErrorCode.InvalidParams, "entityTypes must be array of strings");
    }
  }

  const validSearchModes = ["semantic", "keyword", "hybrid"];
  if (searchMode !== undefined) {
    if (typeof searchMode !== "string" || !validSearchModes.includes(searchMode)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "searchMode must be one of: semantic, keyword, hybrid"
      );
    }
  }

  const { collection } = args;
  if (collection !== undefined && typeof collection !== "string") {
    throw new McpError(ErrorCode.InvalidParams, "collection must be a string");
  }

  return {
    query,
    entityTypes,
    limit,
    searchMode: searchMode as "semantic" | "keyword" | "hybrid" | undefined,
    collection: collection,
  };
}

export function validateGetImplementationRequest(args: unknown): GetImplementationRequest {
  if (!isRecord(args)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid request format");
  }

  // Support both camelCase and snake_case parameter names for compatibility
  const { entityName, entity_name, scope } = args;
  const finalEntityName = entityName || entity_name;

  if (typeof finalEntityName !== "string") {
    throw new McpError(ErrorCode.InvalidParams, "Missing or invalid entityName string");
  }

  const validScopes = ["minimal", "logical", "dependencies"];
  const finalScope = scope || "minimal";

  if (typeof finalScope !== "string" || !validScopes.includes(finalScope)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Invalid scope. Must be: minimal, logical, or dependencies"
    );
  }

  const { collection } = args;
  if (collection !== undefined && typeof collection !== "string") {
    throw new McpError(ErrorCode.InvalidParams, "collection must be a string");
  }

  return {
    entityName: finalEntityName,
    scope: finalScope as "minimal" | "logical" | "dependencies",
    collection: collection,
  };
}

export function validateReadGraphRequest(args: unknown): ReadGraphRequest {
  if (!isRecord(args)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid request format");
  }

  const { mode, limit, entityTypes, entity, collection } = args;

  const validModes = ["smart", "entities", "relationships", "raw"];
  if (mode !== undefined) {
    if (typeof mode !== "string" || !validModes.includes(mode)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "mode must be one of: smart, entities, relationships, raw"
      );
    }
  }

  if (limit !== undefined && (typeof limit !== "number" || limit <= 0)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid limit value");
  }

  if (entityTypes !== undefined) {
    if (!Array.isArray(entityTypes) || !entityTypes.every((t) => typeof t === "string")) {
      throw new McpError(ErrorCode.InvalidParams, "entityTypes must be array of strings");
    }
  }

  if (entity !== undefined && typeof entity !== "string") {
    throw new McpError(ErrorCode.InvalidParams, "entity must be a string");
  }

  if (collection !== undefined && typeof collection !== "string") {
    throw new McpError(ErrorCode.InvalidParams, "collection must be a string");
  }

  return {
    mode: mode as "smart" | "entities" | "relationships" | "raw" | undefined,
    limit: limit,
    entityTypes: entityTypes,
    entity: entity,
    collection: collection,
  };
}

export function validateSearchDocsRequest(args: unknown): SearchDocsRequest {
  if (!isRecord(args)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid request format");
  }

  const { query, docTypes, limit, collection } = args;

  if (typeof query !== "string" || query.trim().length === 0) {
    throw new McpError(ErrorCode.InvalidParams, "Missing or invalid query string");
  }

  // Input size validation: check query length
  if (query.length > INPUT_LIMITS.QUERY_MAX_LENGTH) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Query exceeds maximum length of ${INPUT_LIMITS.QUERY_MAX_LENGTH} characters (received ${query.length})`
    );
  }

  const validDocTypes = ["prd", "tdd", "adr", "spec"];
  if (docTypes !== undefined) {
    if (
      !Array.isArray(docTypes) ||
      !docTypes.every((t) => typeof t === "string" && validDocTypes.includes(t))
    ) {
      throw new McpError(ErrorCode.InvalidParams, "docTypes must be array of: prd, tdd, adr, spec");
    }
  }

  if (limit !== undefined && (typeof limit !== "number" || limit <= 0)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid limit value");
  }

  if (collection !== undefined && typeof collection !== "string") {
    throw new McpError(ErrorCode.InvalidParams, "collection must be a string");
  }

  return { query, docTypes: docTypes as SearchDocsRequest["docTypes"], limit, collection };
}

export function validateGetDocRequest(args: unknown): GetDocRequest {
  if (!isRecord(args)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid request format");
  }

  const { docId, section, collection } = args;

  if (typeof docId !== "string" || docId.trim().length === 0) {
    throw new McpError(ErrorCode.InvalidParams, "Missing or invalid docId string");
  }

  if (section !== undefined && typeof section !== "string") {
    throw new McpError(ErrorCode.InvalidParams, "section must be a string");
  }

  if (collection !== undefined && typeof collection !== "string") {
    throw new McpError(ErrorCode.InvalidParams, "collection must be a string");
  }

  return { docId, section, collection };
}

// Ticket integration types (Milestone 8.3)
export interface SearchTicketsRequest {
  query?: string;
  status?: ("open" | "in_progress" | "done" | "cancelled")[];
  labels?: string[];
  source?: ("linear" | "github")[];
  limit?: number;
  collection?: string;
}

export interface GetTicketRequest {
  ticketId: string;
  includeComments?: boolean;
  includePRs?: boolean;
  collection?: string;
}

export function validateSearchTicketsRequest(args: unknown): SearchTicketsRequest {
  if (!isRecord(args)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid request format");
  }

  const { query, status, labels, source, limit, collection } = args;

  // At least one search parameter required
  if (!query && !status && !labels && !source) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "At least one search parameter required (query, status, labels, or source)"
    );
  }

  if (query !== undefined && typeof query !== "string") {
    throw new McpError(ErrorCode.InvalidParams, "query must be a string");
  }

  const validStatuses = ["open", "in_progress", "done", "cancelled"];
  if (status !== undefined) {
    if (
      !Array.isArray(status) ||
      !status.every((s) => typeof s === "string" && validStatuses.includes(s))
    ) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `status must be array of: ${validStatuses.join(", ")}`
      );
    }
  }

  if (labels !== undefined) {
    if (!Array.isArray(labels) || !labels.every((l) => typeof l === "string")) {
      throw new McpError(ErrorCode.InvalidParams, "labels must be array of strings");
    }
  }

  const validSources = ["linear", "github"];
  if (source !== undefined) {
    if (
      !Array.isArray(source) ||
      !source.every((s) => typeof s === "string" && validSources.includes(s))
    ) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `source must be array of: ${validSources.join(", ")}`
      );
    }
  }

  if (limit !== undefined && (typeof limit !== "number" || limit <= 0)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid limit value");
  }

  if (collection !== undefined && typeof collection !== "string") {
    throw new McpError(ErrorCode.InvalidParams, "collection must be a string");
  }

  return {
    query: query,
    status: status as SearchTicketsRequest["status"],
    labels: labels,
    source: source as SearchTicketsRequest["source"],
    limit: limit,
    collection: collection,
  };
}

export function validateGetTicketRequest(args: unknown): GetTicketRequest {
  if (!isRecord(args)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid request format");
  }

  const { ticketId, includeComments, includePRs, collection } = args;

  if (typeof ticketId !== "string" || ticketId.trim().length === 0) {
    throw new McpError(ErrorCode.InvalidParams, "Missing or invalid ticketId string");
  }

  if (includeComments !== undefined && typeof includeComments !== "boolean") {
    throw new McpError(ErrorCode.InvalidParams, "includeComments must be a boolean");
  }

  if (includePRs !== undefined && typeof includePRs !== "boolean") {
    throw new McpError(ErrorCode.InvalidParams, "includePRs must be a boolean");
  }

  if (collection !== undefined && typeof collection !== "string") {
    throw new McpError(ErrorCode.InvalidParams, "collection must be a string");
  }

  return {
    ticketId,
    includeComments: includeComments,
    includePRs: includePRs,
    collection: collection,
  };
}

// Plan Mode access control types (Milestone 8.4)
export interface SetPlanModeRequest {
  enabled: boolean;
}

export function validateSetPlanModeRequest(args: unknown): SetPlanModeRequest {
  if (!isRecord(args)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid request format");
  }

  const { enabled } = args;
  if (typeof enabled !== "boolean") {
    throw new McpError(ErrorCode.InvalidParams, "enabled must be a boolean");
  }

  return { enabled };
}
