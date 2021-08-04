import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLScalarType,
  GraphQLEnumType,
  GraphQLInputFieldConfigMap,
  DirectiveNode,
  GraphQLFieldConfigArgumentMap,
  isNonNullType,
} from "graphql";
import { MapperKind, mapSchema } from "@graphql-tools/utils";
import { getWrappedType } from "./get-wrapped-type";
import { Maybe } from "graphql/jsutils/Maybe";

const builtInTypes = new Set([
  "String",
  "Int",
  "Float",
  "Boolean",
  "Query",
  "Mutation",
  "ID",
]);

const colorYellow = "\x1b[33m";
const colorReset = "\x1b[0m";

const logWarning = (text: string) =>
  // eslint-disable-next-line no-console
  console.warn(`${colorYellow}${text}${colorReset}`);

export type SharedExtensionAndDirectiveInformation = {
  extensions?: Maybe<{
    [attributeName: string]: any;
  }>;
  astNode?: Maybe<
    Readonly<{
      directives?: ReadonlyArray<DirectiveNode>;
    }>
  >;
};

/**
 * The default function used for determining whether a type or field should be public.
 */
export const defaultIsPublic = (
  input: SharedExtensionAndDirectiveInformation
): boolean =>
  input.extensions?.["isPublic"] === true ||
  !!input.astNode?.directives?.find(
    (directive) => directive.name.value === "public"
  );

export type BuildPublicSchemaParameter = {
  /** The GraphQL schema that should be filtered. */
  schema: GraphQLSchema;
  /** Overwrite this function for customizing how fields are determined as public. Uses `defaultIsPublic` per default. */
  isPublic?: typeof defaultIsPublic;
};

/**
 * Maps the input schema to a public schema that only includes types and fields that are marked as public.
 * Conflicts that would result in an invalid schema, will be printed to the console.
 * The implementation tries to construct a valid schema by automatically hiding invalid constructs (such as empty ObjectTypes or fields whose return type is not public).
 */
export const buildPublicSchema = (
  params: BuildPublicSchemaParameter
): GraphQLSchema => {
  const isPublic = params.isPublic ?? defaultIsPublic;
  const publicTypeNames: Set<string> = new Set(builtInTypes);
  const publicFieldReturnTypes: Map<string, string> = new Map();
  const publicFieldArguments: Map<string, Set<string>> = new Map();
  const publicFieldArgumentTypes: Map<string, string[]> = new Map();
  const unionTypes = new Set<GraphQLUnionType>();
  const interfaceTypes: Map<string, string[]> = new Map();

  const types = params.schema.getTypeMap();

  for (const ttype of Object.values(types)) {
    // Skip internal types
    if (ttype.name.startsWith("__")) {
      continue;
    }

    if (
      ttype instanceof GraphQLScalarType ||
      ttype instanceof GraphQLEnumType
    ) {
      if (isPublic(ttype)) {
        publicTypeNames.add(ttype.name);
      }
    } else if (ttype instanceof GraphQLUnionType) {
      if (isPublic(ttype)) {
        publicTypeNames.add(ttype.name);
        unionTypes.add(ttype);
      }
    } else if (
      ttype instanceof GraphQLInterfaceType ||
      ttype instanceof GraphQLObjectType
    ) {
      const isTypePublic = isPublic(ttype);

      const fields = ttype.getFields();
      const isAnyFieldPublic = !!Array.from(Object.values(fields)).find(
        (field) => isPublic(field)
      );
      if (isTypePublic === true || isAnyFieldPublic === true) {
        publicTypeNames.add(ttype.name);
        interfaceTypes.set(
          ttype.name,
          ttype.getInterfaces().map((inter) => inter.name)
        );

        for (const field of Object.values(fields)) {
          const isFieldPublic = isPublic(field);
          if (isFieldPublic === true || isTypePublic === true) {
            publicFieldReturnTypes.set(
              `${ttype.name}.${field.name}`,
              getWrappedType(field.type).name
            );
            const fieldArgumentTypes: Array<string> = [];
            const fieldArguments = new Set<string>();
            for (const arg of field.args) {
              if (isNonNullType(arg.type) || isPublic(arg)) {
                fieldArguments.add(arg.name);
                fieldArgumentTypes.push(getWrappedType(arg.type).name);
              }
            }

            if (fieldArgumentTypes.length) {
              publicFieldArgumentTypes.set(
                `${ttype.name}.${field.name}`,
                fieldArgumentTypes
              );
              publicFieldArguments.set(
                `${ttype.name}.${field.name}`,
                fieldArguments
              );
            }
          }
        }
      }
    } else if (ttype instanceof GraphQLInputObjectType) {
      const fields = ttype.getFields();
      const isTypePublic = isPublic(ttype);
      const isAnyFieldPublic = !!Array.from(Object.values(fields)).find(
        (field) => isPublic(field)
      );

      if (isTypePublic === true || isAnyFieldPublic === true) {
        publicTypeNames.add(ttype.name);

        for (const field of Object.values(fields)) {
          const isFieldPublic = isPublic(field);
          if (isTypePublic === true || isFieldPublic === true) {
            publicFieldReturnTypes.set(
              `${ttype.name}.${field.name}`,
              getWrappedType(field.type).name
            );
          }
        }
      }
    }
  }

  const allAvailableFields = new Set(publicFieldReturnTypes.keys());

  // check availability of union types
  for (let unionType of unionTypes) {
    const types = unionType.getTypes();
    for (let unionTypeMember of types) {
      if (!publicTypeNames.has(unionTypeMember.name)) {
        publicTypeNames.delete(unionType.name);
        logWarning(
          `[public-introspection-filter] Type "${unionTypeMember.name}" is not marked as public.\n` +
            ` -> The union "${unionType}" will not be marked as visible.`
        );
      }
    }
  }

  // check availability of interface types
  for (let [type, implementedInterfaces] of interfaceTypes) {
    for (let interfaceName of implementedInterfaces) {
      if (!publicTypeNames.has(interfaceName)) {
        publicTypeNames.delete(type);
        logWarning(
          `[public-introspection-filter] Interface "${interfaceName}" is not marked as public.\n` +
            ` -> The type "${type}" which implements the interface will not be marked as visible.`
        );
      }
    }
  }

  // check availability of fields
  for (let [fieldPath, returnType] of publicFieldReturnTypes) {
    if (!publicTypeNames.has(returnType)) {
      logWarning(
        `[public-introspection-filter] Type "${returnType}" is not marked as public.\n` +
          ` -> The field "${fieldPath}" will not be marked as visible.`
      );
      allAvailableFields.delete(fieldPath);
    }
    // @TODO: if field type is an interface type:
    // warn or strict mode --> only allow fields if all types that implement the fie
    // what if query returns type that is not known to the client?
  }

  // check availability of input arguments
  for (let [fieldPath, inputTypes] of publicFieldArgumentTypes) {
    for (let inputType of inputTypes) {
      if (!publicTypeNames.has(inputType)) {
        logWarning(
          `[public-introspection-filter] Input Type "${inputType}" is not marked as public.\n` +
            ` -> The field "${fieldPath}" will not be marked as visible.`
        );
        allAvailableFields.delete(fieldPath);
      }
    }

    // @TODO
    // Required input arguments must always be public (or the Input Object type must be public.)
  }

  return mapSchema(params.schema, {
    [MapperKind.OBJECT_TYPE]: (ttype) => {
      const config = ttype.toConfig();
      if (!publicTypeNames.has(config.name)) {
        return null;
      }

      const newFields: GraphQLFieldConfigMap<any, any> = {};
      for (const [name, fieldConfig] of Object.entries(config.fields)) {
        if (
          allAvailableFields.has(`${config.name}.${name}`) &&
          publicTypeNames.has(getWrappedType(fieldConfig.type).name)
        ) {
          const args: GraphQLFieldConfigArgumentMap = {};

          if (fieldConfig.args != null) {
            const publicArguments = publicFieldArguments.get(
              `${ttype.name}.${name}`
            );
            if (publicArguments != null) {
              for (const [argName, arg] of Object.entries(fieldConfig.args)) {
                if (publicArguments.has(argName)) {
                  args[argName] = arg;
                }
              }
            }
          }

          newFields[name] = {
            ...fieldConfig,
            args,
          };
        }
      }
      config.fields = newFields;
      return new GraphQLObjectType(config);
    },
    [MapperKind.INPUT_OBJECT_TYPE]: (objectType) => {
      const config = objectType.toConfig();
      if (!publicTypeNames.has(config.name)) {
        return null;
      }
      const newFields: GraphQLInputFieldConfigMap = {};
      for (const [name, fieldConfig] of Object.entries(config.fields)) {
        if (
          allAvailableFields.has(`${config.name}.${name}`) &&
          publicTypeNames.has(getWrappedType(fieldConfig.type).name)
        ) {
          newFields[name] = fieldConfig;
        }
      }
      config.fields = newFields;
      return new GraphQLInputObjectType(config);
    },
    [MapperKind.DIRECTIVE]: (directive) =>
      directive.name === "public" ? null : directive,
    [MapperKind.UNION_TYPE]: (unionType) => {
      const config = unionType.toConfig();
      const isPublic = config.types.every((objectType) =>
        publicTypeNames.has(getWrappedType(objectType).name)
      );

      return isPublic ? unionType : null;
    },
    [MapperKind.INTERFACE_TYPE]: (interfaceType) => {
      const config = interfaceType.toConfig();
      if (!publicTypeNames.has(config.name)) {
        return null;
      }

      const newFields: GraphQLFieldConfigMap<any, any> = {};
      for (const [name, fieldConfig] of Object.entries(config.fields)) {
        if (
          allAvailableFields.has(`${config.name}.${name}`) &&
          publicTypeNames.has(getWrappedType(fieldConfig.type).name)
        ) {
          newFields[name] = fieldConfig;
        }
      }
      config.fields = newFields;

      return new GraphQLInterfaceType(config);
    },
    [MapperKind.SCALAR_TYPE]: (ttype) =>
      publicTypeNames.has(ttype.name) ? ttype : null,
    [MapperKind.ENUM_TYPE]: (ttype) =>
      publicTypeNames.has(ttype.name) ? ttype : null,
  });
};
