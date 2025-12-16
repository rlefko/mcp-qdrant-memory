import type { Relation } from "../../types.js";

export const validRelation: Relation = {
  from: "AuthService",
  to: "UserModel",
  relationType: "uses",
};

export const validRelations: Relation[] = [
  { from: "AuthService", to: "validateToken", relationType: "calls" },
  { from: "UserModel", to: "DatabaseService", relationType: "stored_in" },
  { from: "MainController", to: "AuthService", relationType: "imports" },
];

export const invalidRelationMissingFrom = {
  to: "Target",
  relationType: "uses",
};

export const invalidRelationMissingTo = {
  from: "Source",
  relationType: "uses",
};

export const invalidRelationMissingType = {
  from: "Source",
  to: "Target",
};

export const invalidRelationNonStringFrom = {
  from: 123,
  to: "Target",
  relationType: "uses",
};
