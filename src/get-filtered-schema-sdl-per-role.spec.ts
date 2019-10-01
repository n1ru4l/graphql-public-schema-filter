import { getFilteredSchemaSdlPerRole } from "./get-filtered-schema-sdl-per-role";
import { createPublicDirectiveTypeDefs } from "./graphql-introspection-filter";

it("can create schema for different roles", () => {
  const typeDefs = /* GraphQL */ `
    type Query {
      foo: String! @public(roles: ["DEFAULT", "ROLE_1"])
      secret: String! @public(roles: ["ROLE_1"])
    }

    ${createPublicDirectiveTypeDefs()}
  `;

  const result = getFilteredSchemaSdlPerRole(typeDefs, {
    reporter: () => {}
  });

  expect(result).toEqual({
    DEFAULT: `type Query {\n  foo: String!\n}\n`,
    ROLE_1: `type Query {\n  foo: String!\n  secret: String!\n}\n`
  });
});
