// Type definitions for graphql-introspection-filtering 1.0
// Project: xxxxx
// Definitions by: n1ru4l <https://github.com/n1ru4l>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 3.0

/* eslint-disable @typescript-eslint/no-explicit-any */

declare module "graphql-introspection-filtering" {
  import { GraphQLSchema, GraphQLField, GraphQLResolveInfo } from "graphql";

  export type InfoType = GraphQLResolveInfo;

  export type SchemaFilterSig = (
    field: any,
    root: any,
    args: any,
    context: any,
    info: InfoType
  ) => boolean;

  export type FiltersType = {
    field?: Array<SchemaFilterSig>;
    type?: Array<SchemaFilterSig>;
    directive?: Array<SchemaFilterSig>;
  };

  export default function makeFilteredSchema(
    schema: GraphQLSchema,
    filters: FiltersType
  ): GraphQLSchema;
}
