import { makePublicIntrospectionFilter } from "./graphql-introspection-filter";
import {
  buildSchema,
  graphqlSync,
  introspectionQuery,
  printSchema,
  buildClientSchema,
  IntrospectionQuery
} from "graphql";

export const getFilteredSchemaSdlPerRole = (typeDefs: string) => {
  const inputSchema = buildSchema(typeDefs);
  let contextRole: string;
  const { schema, roles } = makePublicIntrospectionFilter(
    inputSchema,
    typeDefs,
    {
      getRoleFromContext: () => contextRole
    }
  );
  const results = new Map<string, string>();
  for (const role of roles) {
    contextRole = role;
    const inrospectionResult = graphqlSync(schema, introspectionQuery);
    const result = printSchema(
      buildClientSchema(inrospectionResult.data as IntrospectionQuery)
    );

    results.set(role, result);
  }

  return results;
};
