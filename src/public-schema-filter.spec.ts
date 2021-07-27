import "@graphql-codegen/testing";
import * as lib from "./public-schema-filter";
import { publicDirectiveSDL } from "./public-directive";
import { makeExecutableSchema } from "@graphql-tools/schema";

import {
  getIntrospectionQuery,
  graphqlSync,
  buildClientSchema,
  IntrospectionQuery,
  printSchema,
  GraphQLSchema,
  lexicographicSortSchema,
  buildASTSchema,
  parse,
} from "graphql";

const buildSchema = (source: string) =>
  makeExecutableSchema({
    typeDefs: [publicDirectiveSDL, source],
    schemaTransforms: [lib.directiveToExtensionsTransform],
  });

const printIntrospectionSdl = (filteredSchema: GraphQLSchema) => {
  const result = graphqlSync(filteredSchema, getIntrospectionQuery());
  if (result.errors) {
    for (const error of result.errors) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
  }
  const generatedSchema = printSchema(
    buildClientSchema(result.data as IntrospectionQuery)
  );

  return generatedSchema;
};

const formatSdl = (schema: GraphQLSchema) => {
  const result = graphqlSync(schema, getIntrospectionQuery());
  if (result.errors) {
    for (const error of result.errors) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
  }
  const introspectionSchema = buildClientSchema(
    result.data as IntrospectionQuery
  );
  return printSchema(lexicographicSortSchema(introspectionSchema));
};

const expectGraphQlSdlEqual = (expected: GraphQLSchema, actual: string) => {
  expect(formatSdl(expected)).toBeSimilarStringTo(
    formatSdl(buildASTSchema(parse(actual)))
  );
};

it("can be called", () => {
  const source = /* GraphQL */ `
    type User {
      id: ID!
      login: String!
    }

    type Query {
      me: User
      hello2: String @public
    }
  `;

  const schema = buildSchema(source);

  const filteredSchema = lib.buildPublicSchema(schema);

  expectGraphQlSdlEqual(
    filteredSchema,
    /* GraphQL */ `
      type Query {
        hello2: String
      }
    `
  );
});

it("does not expose the public directive", () => {
  const source = /* GraphQL */ `
    type User {
      id: ID!
      login: String!
    }

    type Query {
      me: User
      hello2: String @public
    }
  `;

  const schema = buildSchema(source);

  const filteredSchema = lib.buildPublicSchema(schema);
  const sdl = printIntrospectionSdl(filteredSchema);

  expect(sdl.includes("public")).toEqual(false);
});

it("makes type public when its field is public", () => {
  const source = /* GraphQL */ `
    type User {
      id: ID! @public
      login: String!
    }

    type Query {
      me: User @public
      hello2: String
    }
  `;

  const schema = buildSchema(source);

  const filteredSchema = lib.buildPublicSchema(schema);

  expectGraphQlSdlEqual(
    filteredSchema,
    /* GraphQL */ `
      type User {
        id: ID!
      }

      type Query {
        me: User
      }
    `
  );
});

it("makes type public when its extend field is public", () => {
  const source = /* GraphQL */ `
    type User {
      id: ID! @public
      login: String!
    }

    type Query {
      hello2: String
    }

    extend type Query {
      me: User @public
    }
  `;

  const schema = buildSchema(source);

  const filteredSchema = lib.buildPublicSchema(schema);

  expectGraphQlSdlEqual(
    filteredSchema,
    /* GraphQL */ `
      type User {
        id: ID!
      }

      type Query {
        me: User
      }
    `
  );
});

it("makes fields public when type is public", () => {
  const source = /* GraphQL */ `
    type User @public {
      id: ID!
      login: String!
    }

    type Query {
      me: User @public
      hello2: String
    }
  `;

  const schema = buildSchema(source);

  const filteredSchema = lib.buildPublicSchema(schema);

  expectGraphQlSdlEqual(
    filteredSchema,
    /* GraphQL */ `
      type User {
        id: ID!
        login: String!
      }

      type Query {
        me: User
      }
    `
  );
});

it("what if type is not public", () => {
  const source = /* GraphQL */ `
    type User {
      id: ID!
      login: String!
    }

    type Query {
      me: User @public
      hello2: String @public
    }
  `;

  const schema = buildSchema(source);

  const filteredSchema = lib.buildPublicSchema(schema);

  expectGraphQlSdlEqual(
    filteredSchema,
    /* GraphQL */ `
      type Query {
        hello2: String
      }
    `
  );
});

it("does not make unions public when type is not public", () => {
  const source = /* GraphQL */ `
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
  `;

  const schema = buildSchema(source);

  const filteredSchema = lib.buildPublicSchema(schema);

  expectGraphQlSdlEqual(
    filteredSchema,
    /* GraphQL */ `
      type Query {
        hello2: String
      }
    `
  );
});

it("makes unions public when type is public", () => {
  const source = /* GraphQL */ `
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
  `;

  const schema = buildSchema(source);

  const filteredSchema = lib.buildPublicSchema(schema);

  expectGraphQlSdlEqual(
    filteredSchema,
    /* GraphQL */ `
      type UserNotFound {
        reason: String!
      }

      type User {
        id: ID!
        login: String!
      }

      union UserResult = UserNotFound | User

      type Query {
        user: UserResult
        hello2: String
      }
    `
  );
});

it("hides field/type if its interface is public", () => {
  const source = /* GraphQL */ `
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
  `;

  const schema = buildSchema(source);

  const filteredSchema = lib.buildPublicSchema(schema);

  expectGraphQlSdlEqual(
    filteredSchema,
    /* GraphQL */ `
      type Query {
        hello2: String
      }
    `
  );
});

it("exposes field/type if its interface is public", () => {
  const source = /* GraphQL */ `
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
  `;

  const schema = buildSchema(source);

  const filteredSchema = lib.buildPublicSchema(schema);

  expectGraphQlSdlEqual(
    filteredSchema,
    /* GraphQL */ `
      interface Node {
        id: ID!
      }
      type Person implements Node {
        id: ID!
        name: String!
      }
      type Query {
        person: Person
        hello2: String
      }
    `
  );
});

it("hides mutation with input types that are not marked as public", () => {
  const source = /* GraphQL */ `
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
  `;

  const schema = buildSchema(source);

  const filteredSchema = lib.buildPublicSchema(schema);

  expectGraphQlSdlEqual(
    filteredSchema,
    /* GraphQL */ `
      type Query {
        foo: String
      }

      type Mutation {
        foo: String
      }
    `
  );
});

it("shows mutation with input types that are marked as public", () => {
  const source = /* GraphQL */ `
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
  `;

  const schema = buildSchema(source);

  const filteredSchema = lib.buildPublicSchema(schema);

  expectGraphQlSdlEqual(
    filteredSchema,
    /* GraphQL */ `
      input Foo {
        foo: String
      }

      type Query {
        foo: String
      }

      type Mutation {
        foo: String
        person(foo: Foo): String
      }
    `
  );
});

it("exposes Scalars correctly", () => {
  const source = /* GraphQL */ `
    scalar Upload @public

    type Query {
      foo: String @public
    }

    type Mutation {
      foo: String @public
      upload: Upload @public
    }
  `;

  const schema = buildSchema(source);

  const filteredSchema = lib.buildPublicSchema(schema);

  expectGraphQlSdlEqual(
    filteredSchema,
    /* GraphQL */ `
      scalar Upload

      type Query {
        foo: String
      }

      type Mutation {
        foo: String
        upload: Upload
      }
    `
  );
});

it("exposes Input fields correctly", () => {
  const source = /* GraphQL */ `
    input Foo {
      _: Boolean @public
      privateField: Boolean
    }

    type Query {
      foo(input: Foo!): Boolean @public
    }
  `;

  const schema = buildSchema(source);
  const filteredSchema = lib.buildPublicSchema(schema);

  expectGraphQlSdlEqual(
    filteredSchema,
    /* GraphQL */ `
      input Foo {
        _: Boolean
      }

      type Query {
        foo(input: Foo!): Boolean
      }
    `
  );
});
