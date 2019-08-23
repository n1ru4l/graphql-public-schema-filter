import "@graphql-codegen/testing";
import {
  makePublicIntrospectionFilter,
  createPublicDirectiveTypeDefs
} from "./graphql-introspection-filter";
import {
  buildSchema,
  introspectionQuery,
  graphql,
  buildClientSchema,
  IntrospectionQuery,
  printSchema,
  GraphQLSchema
} from "graphql";

const printIntrospectionSdl = async (filteredSchema: GraphQLSchema) => {
  const result = await graphql(filteredSchema, introspectionQuery);
  const generatedSchema = printSchema(
    buildClientSchema(result.data as IntrospectionQuery)
  );

  return generatedSchema;
};

it("can be called", async () => {
  const typeDefs = /* GraphQL */ `
    type User {
      id: ID!
      login: String!
    }

    type Query {
      me: User
      hello2: String @public
    }

    ${createPublicDirectiveTypeDefs()}
  `;

  const schema = buildSchema(typeDefs);

  const { schema: filteredSchema } = makePublicIntrospectionFilter(
    schema,
    typeDefs
  );
  const sdl = await printIntrospectionSdl(filteredSchema);

  expect(sdl).toBeSimilarStringTo(/* GraphQL */ `
    type Query {
      hello2: String
    }
  `);
});

it("does not expose the public directive", async () => {
  const typeDefs = /* GraphQL */ `
    type User {
      id: ID!
      login: String!
    }

    type Query {
      me: User
      hello2: String @public(roles: [DEFAULT])
    }

    enum AccessRole {
      DEFAULT
      SHOWCASE_APP
    }

    ${createPublicDirectiveTypeDefs()}
  `;

  const schema = buildSchema(typeDefs);

  const { schema: filteredSchema } = makePublicIntrospectionFilter(
    schema,
    typeDefs,
    {
      directiveArgumentName: "AccessRole"
    }
  );
  const sdl = await printIntrospectionSdl(filteredSchema);

  expect(sdl.includes("public")).toEqual(false);
});

it("makes type public when its field is public", async () => {
  const typeDefs = /* GraphQL */ `
    type User {
      id: ID! @public
      login: String!
    }

    type Query {
      me: User @public
      hello2: String
    }

    ${createPublicDirectiveTypeDefs()}
  `;

  const schema = buildSchema(typeDefs);

  const { schema: filteredSchema } = makePublicIntrospectionFilter(
    schema,
    typeDefs
  );
  const sdl = await printIntrospectionSdl(filteredSchema);

  expect(sdl).toBeSimilarStringTo(/* GraphQL */ `
    type Query {
      me: User
    }

    type User {
      id: ID!
    }
  `);
});

it("makes fields public when type is public", async () => {
  const typeDefs = /* GraphQL */ `
    type User @public {
      id: ID!
      login: String!
    }

    type Query {
      me: User @public
      hello2: String
    }

    ${createPublicDirectiveTypeDefs()}
  `;

  const schema = buildSchema(typeDefs);

  const { schema: filteredSchema } = makePublicIntrospectionFilter(
    schema,
    typeDefs
  );
  const sdl = await printIntrospectionSdl(filteredSchema);

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

it("what if type is not public", async () => {
  const typeDefs = /* GraphQL */ `
    type User {
      id: ID!
      login: String!
    }

    type Query {
      me: User @public
      hello2: String @public
    }

    ${createPublicDirectiveTypeDefs()}
  `;

  const schema = buildSchema(typeDefs);

  const { schema: filteredSchema } = makePublicIntrospectionFilter(
    schema,
    typeDefs
  );

  const sdl = await printIntrospectionSdl(filteredSchema);

  expect(sdl).toBeSimilarStringTo(/* GraphQL */ `
    type Query {
      hello2: String
    }
  `);
});

it("does not make unions public when type is not public", async () => {
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

    ${createPublicDirectiveTypeDefs()}
  `;

  const schema = buildSchema(typeDefs);

  const { schema: filteredSchema } = makePublicIntrospectionFilter(
    schema,
    typeDefs
  );

  const sdl = await printIntrospectionSdl(filteredSchema);

  expect(sdl).toBeSimilarStringTo(/* GraphQL */ `
    type Query {
      hello2: String
    }
  `);
});

it("makes unions public when type is public", async () => {
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

    ${createPublicDirectiveTypeDefs()}
  `;

  const schema = buildSchema(typeDefs);

  const { schema: filteredSchema } = makePublicIntrospectionFilter(
    schema,
    typeDefs
  );
  const sdl = await printIntrospectionSdl(filteredSchema);

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

it("hides field/type if its interface is public", async () => {
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

    ${createPublicDirectiveTypeDefs()}
  `;

  const schema = buildSchema(typeDefs);

  const { schema: filteredSchema } = makePublicIntrospectionFilter(
    schema,
    typeDefs
  );
  const sdl = await printIntrospectionSdl(filteredSchema);

  expect(sdl).toBeSimilarStringTo(/* GraphQL */ `
    type Query {
      hello2: String
    }
  `);
});

it("exposes field/type if its interface is public", async () => {
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

    ${createPublicDirectiveTypeDefs()}
  `;

  const schema = buildSchema(typeDefs);

  const { schema: filteredSchema } = makePublicIntrospectionFilter(
    schema,
    typeDefs
  );
  const sdl = await printIntrospectionSdl(filteredSchema);

  expect(sdl).toBeSimilarStringTo(/* GraphQL */ `
    type Query {
      person: Person
      hello2: String
    }
  `);
});

it("hides mutation with input types that are not marked as public", async () => {
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

    ${createPublicDirectiveTypeDefs()}
  `;

  const schema = buildSchema(typeDefs);

  const { schema: filteredSchema } = makePublicIntrospectionFilter(
    schema,
    typeDefs
  );
  const sdl = await printIntrospectionSdl(filteredSchema);

  expect(sdl).toBeSimilarStringTo(/* GraphQL */ `
    type Mutation {
      foo: String
    }

    type Query {
      foo: String
    }
  `);
});

it("shows mutation with input types that are marked as public", async () => {
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

    ${createPublicDirectiveTypeDefs()}
  `;

  const schema = buildSchema(typeDefs);

  const { schema: filteredSchema } = makePublicIntrospectionFilter(
    schema,
    typeDefs
  );
  const sdl = await printIntrospectionSdl(filteredSchema);

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

it("exposes Scalars correctly", async () => {
  const typeDefs = /* GraphQL */ `
    scalar Upload @public

    type Query {
      foo: String @public
    }

    type Mutation {
      foo: String @public
      upload: Upload @public
    }

    ${createPublicDirectiveTypeDefs()}
  `;

  const schema = buildSchema(typeDefs);

  const { schema: filteredSchema } = makePublicIntrospectionFilter(
    schema,
    typeDefs
  );
  const sdl = await printIntrospectionSdl(filteredSchema);

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

it("roles: empty role list on field -> field is added to default context", async () => {
  const typeDefs = /* GraphQL */ `
    scalar Upload @public

    type Query {
      foo: String @public(roles: [])
    }

    type Mutation {
      foo: String @public
      upload: Upload @public
    }

    ${createPublicDirectiveTypeDefs()}
  `;

  const schema = buildSchema(typeDefs);

  const { schema: filteredSchema } = makePublicIntrospectionFilter(
    schema,
    typeDefs
  );
  const sdl = await printIntrospectionSdl(filteredSchema);

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

it("roles: empty role list on scalar -> scalar is added to default context", async () => {
  const typeDefs = /* GraphQL */ `
    scalar Upload @public(roles: [])

    type Query {
      foo: String @public(roles: [])
    }

    type Mutation {
      foo: String @public
      upload: Upload @public
    }

    ${createPublicDirectiveTypeDefs()}
  `;

  const schema = buildSchema(typeDefs);

  const { schema: filteredSchema } = makePublicIntrospectionFilter(
    schema,
    typeDefs
  );
  const sdl = await printIntrospectionSdl(filteredSchema);

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

it("roles: empty role list on enum -> enum is added to the default context", async () => {
  const typeDefs = /* GraphQL */ `
    enum Foo @public(roles: []) {
      yesy
    }

    type Query {
      foo: String @public(roles: [])
    }

    type Mutation {
      foo: String @public
    }

    ${createPublicDirectiveTypeDefs()}
  `;

  const schema = buildSchema(typeDefs);

  const { schema: filteredSchema } = makePublicIntrospectionFilter(
    schema,
    typeDefs
  );
  const sdl = await printIntrospectionSdl(filteredSchema);

  expect(sdl).toBeSimilarStringTo(/* GraphQL */ `
    enum Foo {
      yesy
    }

    type Mutation {
      foo: String
    }

    type Query {
      foo: String
    }
  `);
});

it("roles: empty role list on union -> union is added to default context", async () => {
  const typeDefs = /* GraphQL */ `
    type User {
      id: String @public
    }
    union Foo @public(roles: []) = User

    type Query {
      foo: String @public
    }

    type Mutation {
      foo: String @public
    }

    ${createPublicDirectiveTypeDefs()}
  `;

  const schema = buildSchema(typeDefs);

  const { schema: filteredSchema } = makePublicIntrospectionFilter(
    schema,
    typeDefs
  );
  const sdl = await printIntrospectionSdl(filteredSchema);

  expect(sdl).toBeSimilarStringTo(/* GraphQL */ `
    union Foo = User

    type Mutation {
      foo: String
    }

    type Query {
      foo: String
    }

    type User {
      id: String
    }
  `);
});

it("roles: restrict field for specific role", async () => {
  const typeDefs = /* GraphQL */ `
    type Query {
      foo: String @public(roles: ["DEFAULT", "ROLE_1"])
      secret: String @public(roles: ["ROLE_1"])
    }

    type Mutation {
      foo: String @public(roles: ["DEFAULT", "ROLE_1"])
    }

    ${createPublicDirectiveTypeDefs()}
  `;

  const schema = buildSchema(typeDefs);

  let currentRole: "ROLE_1" | null = null;

  const { schema: filteredSchema } = makePublicIntrospectionFilter(
    schema,
    typeDefs,
    {
      getRoleFromContext: () => currentRole
    }
  );
  let sdl = await printIntrospectionSdl(filteredSchema);

  expect(sdl).toBeSimilarStringTo(/* GraphQL */ `
    type Mutation {
      foo: String
    }

    type Query {
      foo: String
    }
  `);

  currentRole = "ROLE_1";
  sdl = await printIntrospectionSdl(filteredSchema);
  expect(sdl).toBeSimilarStringTo(/* GraphQL */ `
    type Mutation {
      foo: String
    }

    type Query {
      foo: String
      secret: String
    }
  `);
});
