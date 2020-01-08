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
  IntrospectionQuery,
  parse,
  validate
} from "graphql";
import { fromEntries } from "./from-entries";

export interface FilterSchemaDefinitionPerRoleOptions {
  reporter?: Reporter;
}

const validateSdl = (typeDefs: string) => {
  const inputSchema = buildSchema(typeDefs);
  const inrospectionResult = graphqlSync(inputSchema, introspectionQuery);
  const clientSchema = buildClientSchema(
    inrospectionResult.data as IntrospectionQuery
  );

  // Could not find a better way to ignore "definition is not executable" errors.
  const errors = validate(clientSchema, parse(typeDefs)).filter(
    error => !error.message.endsWith("definition is not executable.")
  );
  if (errors.length) {
    console.error("Some errors occured while validating the Schema.");
    for (const error of errors) {
      console.error(error.message);
    }
    throw new Error("Schema Validation failed.");
  }
};

export interface FilterSchemaDefinitionPerRoleResult {
  [role: string]: string;
}

export const filterSchemaDefinitionPerRole = (
  typeDefs: string,
  options?: FilterSchemaDefinitionPerRoleOptions
): FilterSchemaDefinitionPerRoleResult => {
  validateSdl(typeDefs);
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
