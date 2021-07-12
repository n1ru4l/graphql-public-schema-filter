# @n1ru4l/graphql-public-schema-filter

This library allows filtering an existing GraphQL schema down into a subset of the original schema. It supports both the code first development flow of building GraphQL schemas (via GraphQL extension fields) and the SDL first development flow (via schema directives).

The implementation is smart and warns the user if the processed annotations would result in an invalid schema such as:

- Object Type without fields
- Field whose type is not part of the schema

If such a scenario is encountered the implementation will propagate and hide all fields/types that use types that are not marked as public or that would be invalid.

## Why would you need this?

As I have been building GraphQL APIs I often had the need to have both a private and public API.

The private API is used for in-house products. Breaking changes can and will occur. It also includes mutations specific to in-house application built around the API. The public API, however, is used by individuals not part of our organization. We cannot simply roll out breaking changes to our GraphQL API for those. Furthermore, they should only have access to a subset of the whole GraphQL graph. By generating a subgraph out of the internal graph we can hide stuff, without having to maintain and build two GraphQL schema.

## Install instructions

This library requires `graphql` as a peer dependency and has a runtime dependency on `@graphql-tools/utils`.

```bash
yarn add -E @n1ru4l/graphql-public-schema-filter
```

## Usage Instructions

This library is designed to be inclusive for anyone within the GraphQL.js ecosystem. It supports both the SDL `makeExecutableSchema` and code-first via extension fields flow.

There is no delegation or validation overhead when executing against the newly generated schema. It is highly recommended to built the public schema during server-startup and not on the fly during incoming requests.

### Code-First

Annotate types and fields that should be public with the `isPublic` extension.

```ts
import { GraphQLObjectType, GraphQLString } from "graphql";
import { buildPublicSchema } from "@n1ru4l/graphql-public-schema-filter";

const GraphQLQueryType = new GraphQLObjectType({
  name: "Query",
  fields: {
    hello: {
      type: GraphQLString,
      resolve: () => "hi",
      extensions: {
        isPublic: true,
      },
    },
    secret: {
      type: GraphQLString,
      resolve: () => "sup",
    },
  },
});

const privateSchema = new GraphQLSchema({
  query: GraphQLQueryType,
});
const publicSchema = buildPublicSchema(privateSchema);
// serve privateSchema or publicSchema based on the request :)
```

You can also find this example within `examples/src/schema.ts`.

### SDL-First

This package exposes a `directiveToExtensionsTransform` function that can be passed to the `makeExecutableSchema` `schemaTransforms` options. It will map schema fragment usages to the `isPublic` extension fields.

```tsx
import { makeExecutableSchema } from "@graphql-tools/schema";
import {
  publicDirectiveSDL,
  directiveToExtensionsTransform,
  buildPublicSchema,
} from "@n1ru4l/graphql-public-schema-filter";

const source = /* GraphQL */ `
  type Query {
    hello: String @public
    secret: String
  }
`;

const privateSchema = makeExecutableSchema({
  typeDefs: [publicDirectiveSDL, source],
  schemaTransforms: [directiveToExtensionsTransform],
});
const publicSchema = buildPublicSchema(privateSchema);
// serve privateSchema or publicSchema based on the request :)
```

## FAQ

### Why is the no more granular control that allows building multiple unique public schemas?

I considered this at the beginning, but in practice we never had a use for this. Having multiple public schemas requires maintaining a lot of documentation. In our use-case we only have a public and a private schema. There is still role based access for the public schema. certain users are not allowed to select specific fields. Instead of hiding those fields for those users we instead deny operations that select fields the users are not allowed to select before even executing it with the [envelop `useOperationFieldPermissions` plugin](https://www.envelop.dev/plugins/use-operation-field-permissions).

If you need to build many unique schemas based on different parameters and think it is a good idea please open a issue or a pull request so we can discuss a implementation.

## License

MIT
