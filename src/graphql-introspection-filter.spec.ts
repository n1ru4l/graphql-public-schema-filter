import "@graphql-codegen/testing";

import { makePublicIntrospectionFilter } from "./graphql-introspection-filter";
import {
  buildSchema,
  introspectionQuery,
  graphqlSync,
  buildClientSchema,
  IntrospectionQuery,
  printSchema,
  GraphQLSchema
} from "graphql";

const printIntrospectionSdl = (filteredSchema: GraphQLSchema) => {
  const result = graphqlSync(filteredSchema, introspectionQuery);
  const generatedSchema = printSchema(
    buildClientSchema(result.data as IntrospectionQuery)
  );

  return generatedSchema;
};

it("can be called", () => {
  const typeDefs = /* GraphQL */ `
    type User {
      id: ID!
      login: String!
    }

    type Query {
      me: User
      hello2: String @public
    }

    directive @public on OBJECT | FIELD_DEFINITION | ENUM | UNION | INTERFACE | INPUT_OBJECT | SCALAR
  `;

  const schema = buildSchema(typeDefs);

  const filteredSchema = makePublicIntrospectionFilter(schema, typeDefs);
  const sdl = printIntrospectionSdl(filteredSchema);

  expect(sdl).toBeSimilarStringTo(/* GraphQL */ `
    type Query {
      hello2: String
    }
  `);
});

it("does not expose the public directive", () => {
  const typeDefs = /* GraphQL */ `
    type User {
      id: ID!
      login: String!
    }

    type Query {
      me: User
      hello2: String @public
    }

    directive @public on OBJECT | FIELD_DEFINITION | ENUM | UNION | INTERFACE | INPUT_OBJECT | SCALAR
  `;

  const schema = buildSchema(typeDefs);

  const filteredSchema = makePublicIntrospectionFilter(schema, typeDefs);
  const sdl = printIntrospectionSdl(filteredSchema);

  expect(sdl.includes("public")).toEqual(false);
});

it("makes type public when its field is public", () => {
  const typeDefs = /* GraphQL */ `
    type User {
      id: ID! @public
      login: String!
    }

    type Query {
      me: User @public
      hello2: String
    }

    directive @public on OBJECT | FIELD_DEFINITION | ENUM | UNION | INTERFACE | INPUT_OBJECT | SCALAR
  `;

  const schema = buildSchema(typeDefs);

  const filteredSchema = makePublicIntrospectionFilter(schema, typeDefs);
  const sdl = printIntrospectionSdl(filteredSchema);

  expect(sdl).toBeSimilarStringTo(/* GraphQL */ `
    type Query {
      me: User
    }

    type User {
      id: ID!
    }
  `);
});

it("makes fields public when type is public", () => {
  const typeDefs = /* GraphQL */ `
    type User @public {
      id: ID!
      login: String!
    }

    type Query {
      me: User @public
      hello2: String
    }

    directive @public on OBJECT | FIELD_DEFINITION | ENUM | UNION | INTERFACE | INPUT_OBJECT | SCALAR
  `;

  const schema = buildSchema(typeDefs);

  const filteredSchema = makePublicIntrospectionFilter(schema, typeDefs);
  const sdl = printIntrospectionSdl(filteredSchema);

  expect(sdl).toBeSimilarStringTo(/* GraphQL */ `
    type Query {
      me: User
    }

    type User {
      id: ID!
      login: String!
    }
  `);
});

it("what if type is not public", () => {
  const typeDefs = /* GraphQL */ `
    type User {
      id: ID!
      login: String!
    }

    type Query {
      me: User @public
      hello2: String @public
    }

    directive @public on OBJECT | FIELD_DEFINITION | ENUM | UNION | INTERFACE | INPUT_OBJECT | SCALAR
  `;

  const schema = buildSchema(typeDefs);

  const filteredSchema = makePublicIntrospectionFilter(schema, typeDefs);

  const sdl = printIntrospectionSdl(filteredSchema);

  expect(sdl).toBeSimilarStringTo(/* GraphQL */ `
    type Query {
      hello2: String
    }
  `);
});

it("does not make unions public when type is not public", () => {
  const typeDefs = /* GraphQL */ `
    type UserNotFound {
      reason: String!
    }

    type User @public {
      id: ID!
      login: String!
    }

    union UserResult @public = UserNotFound | User

    type Query {
      user: UserResult @public
      hello2: String @public
    }

    directive @public on OBJECT | FIELD_DEFINITION | ENUM | UNION | INTERFACE | INPUT_OBJECT | SCALAR
  `;

  const schema = buildSchema(typeDefs);

  const filteredSchema = makePublicIntrospectionFilter(schema, typeDefs);

  const sdl = printIntrospectionSdl(filteredSchema);

  expect(sdl).toBeSimilarStringTo(/* GraphQL */ `
    type Query {
      hello2: String
    }
  `);
});

it("makes unions public when type is public", () => {
  const typeDefs = /* GraphQL */ `
    type UserNotFound {
      reason: String! @public
    }

    type User @public {
      id: ID!
      login: String!
    }

    union UserResult @public = UserNotFound | User

    type Query {
      user: UserResult @public
      hello2: String @public
    }

    directive @public on OBJECT | FIELD_DEFINITION | ENUM | UNION | INTERFACE | INPUT_OBJECT | SCALAR
  `;

  const schema = buildSchema(typeDefs);

  const filteredSchema = makePublicIntrospectionFilter(schema, typeDefs);
  const sdl = printIntrospectionSdl(filteredSchema);

  expect(sdl).toBeSimilarStringTo(/* GraphQL */ `
    type Query {
      user: UserResult
      hello2: String
    }

    type User {
      id: ID!
      login: String!
    }

    type UserNotFound {
      reason: String!
    }

    union UserResult = UserNotFound | User
  `);
});

it("hides field/type if its interface is public", () => {
  const typeDefs = /* GraphQL */ `
    interface Node {
      id: ID!
    }

    type Book implements Node {
      id: ID!
      title: String!
    }

    type Person implements Node @public {
      id: ID!
      name: String!
    }

    type Query {
      node: Node @public
      person: Person @public
      hello2: String @public
    }

    directive @public on OBJECT | FIELD_DEFINITION | ENUM | UNION | INTERFACE | INPUT_OBJECT | SCALAR
  `;

  const schema = buildSchema(typeDefs);

  const filteredSchema = makePublicIntrospectionFilter(schema, typeDefs);
  const sdl = printIntrospectionSdl(filteredSchema);

  expect(sdl).toBeSimilarStringTo(/* GraphQL */ `
    type Query {
      hello2: String
    }
  `);
});

it("exposes field/type if its interface is public", () => {
  const typeDefs = /* GraphQL */ `
    interface Node @public {
      id: ID!
    }

    type Book implements Node {
      id: ID!
      title: String!
    }

    type Person implements Node @public {
      id: ID!
      name: String!
    }

    type Query {
      node: Node
      person: Person @public
      hello2: String @public
    }

    directive @public on OBJECT | FIELD_DEFINITION | ENUM | UNION | INTERFACE | INPUT_OBJECT | SCALAR
  `;

  const schema = buildSchema(typeDefs);

  const filteredSchema = makePublicIntrospectionFilter(schema, typeDefs);
  const sdl = printIntrospectionSdl(filteredSchema);

  expect(sdl).toBeSimilarStringTo(/* GraphQL */ `
    type Query {
      person: Person
      hello2: String
    }
  `);
});

it("hides mutation with input types that are not marked as public", () => {
  const typeDefs = /* GraphQL */ `
    input Foo {
      foo: String
    }

    type Query {
      foo: String @public
    }

    type Mutation {
      foo: String @public
      person(foo: Foo): String @public
    }

    directive @public on OBJECT | FIELD_DEFINITION | ENUM | UNION | INTERFACE | INPUT_OBJECT | SCALAR
  `;

  const schema = buildSchema(typeDefs);

  const filteredSchema = makePublicIntrospectionFilter(schema, typeDefs);
  const sdl = printIntrospectionSdl(filteredSchema);

  expect(sdl).toBeSimilarStringTo(/* GraphQL */ `
    type Mutation {
      foo: String
    }

    type Query {
      foo: String
    }
  `);
});

it("shows mutation with input types that are marked as public", () => {
  const typeDefs = /* GraphQL */ `
    input Foo @public {
      foo: String
    }

    type Query {
      foo: String @public
    }

    type Mutation {
      foo: String @public
      person(foo: Foo): String @public
    }

    directive @public on OBJECT | FIELD_DEFINITION | ENUM | UNION | INTERFACE | INPUT_OBJECT | SCALAR
  `;

  const schema = buildSchema(typeDefs);

  const filteredSchema = makePublicIntrospectionFilter(schema, typeDefs);
  const sdl = printIntrospectionSdl(filteredSchema);

  expect(sdl).toBeSimilarStringTo(/* GraphQL */ `
    input Foo {
      foo: String
    }

    type Mutation {
      foo: String
      person(foo: Foo): String
    }

    type Query {
      foo: String
    }
  `);
});

it("exposes Scalars correctly", () => {
  const typeDefs = /* GraphQL */ `
    scalar Upload @public

    type Query {
      foo: String @public
    }

    type Mutation {
      foo: String @public
      upload: Upload @public
    }

    directive @public on OBJECT | FIELD_DEFINITION | ENUM | UNION | INTERFACE | INPUT_OBJECT | SCALAR
  `;

  const schema = buildSchema(typeDefs);

  const filteredSchema = makePublicIntrospectionFilter(schema, typeDefs);
  const sdl = printIntrospectionSdl(filteredSchema);

  expect(sdl).toBeSimilarStringTo(/* GraphQL */ `
    type Mutation {
      foo: String
      upload: Upload
    }

    type Query {
      foo: String
    }
  `);
});
