import { GraphQLObjectType, GraphQLSchema, GraphQLString } from "graphql";
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

export const privateSchema = new GraphQLSchema({
  query: GraphQLQueryType,
});
export const publicSchema = buildPublicSchema({
  schema: privateSchema
});
