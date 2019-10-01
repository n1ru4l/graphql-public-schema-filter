import {
  makePublicIntrospectionFilter,
  Reporter
} from "./graphql-introspection-filter";
import {
  buildSchema,
  graphqlSync,
  introspectionQuery,
  printSchema,
  buildClientSchema,
  IntrospectionQuery
} from "graphql";
import { fromEntries } from "./from-entries";

interface FilterSchemaDefinitionPerRoleOptions {
  reporter?: Reporter;
}

export const filterSchemaDefinitionPerRole = (
  typeDefs: string,
  options?: FilterSchemaDefinitionPerRoleOptions
) => {
  const inputSchema = buildSchema(typeDefs);
  let contextRole: string;
  const { schema, roles } = makePublicIntrospectionFilter(
    inputSchema,
    typeDefs,
    {
      ...options,
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

  return fromEntries(results.entries());
};
