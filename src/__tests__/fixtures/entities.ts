import type { Entity } from "../../types.js";

export const validEntity: Entity = {
  name: "TestEntity",
  entityType: "class",
  observations: ["A test entity for unit tests"],
};

export const validEntities: Entity[] = [
  {
    name: "AuthService",
    entityType: "class",
    observations: ["Handles authentication"],
  },
  {
    name: "validateToken",
    entityType: "function",
    observations: ["Validates JWT tokens"],
  },
  {
    name: "UserModel",
    entityType: "interface",
    observations: ["User data structure"],
  },
];

export const entityWithMultipleObservations: Entity = {
  name: "ComplexService",
  entityType: "class",
  observations: [
    "Handles complex business logic",
    "Integrates with external APIs",
    "Manages database transactions",
  ],
};

export const invalidEntityMissingName = {
  entityType: "class",
  observations: [],
};

export const invalidEntityMissingType = {
  name: "Test",
  observations: [],
};

export const invalidEntityBadObservations = {
  name: "Test",
  entityType: "class",
  observations: "not-an-array",
};

export const invalidEntityNonStringName = {
  name: 123,
  entityType: "class",
  observations: [],
};
