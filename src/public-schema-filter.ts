import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLNamedType,
  GraphQLUnionType,
  GraphQLScalarType,
  GraphQLEnumType,
  GraphQLType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLInputType,
  GraphQLOutputType,
  GraphQLInputFieldConfigMap,
} from "graphql";
import { MapperKind, mapSchema } from "@graphql-tools/utils";
import { getWrappedType } from "./get-wrapped-type";

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

/**
 * Maps the input schema to a public schema that only includes types/fields whose extensions.isPublic value is set to true.
 */
export const buildPublicSchema = (schema: GraphQLSchema) => {
  const publicTypeNames: Set<string> = new Set(builtInTypes);
  const publicFieldReturnTypes: Map<string, string> = new Map();
  const publicFieldArgumentTypes: Map<string, string[]> = new Map();
  const unionTypes = new Set<GraphQLUnionType>();
  const interfaceTypes: Map<string, string[]> = new Map();

  const types = schema.getTypeMap();

  for (const ttype of Object.values(types)) {
    // Skip internal types
    if (ttype.name.startsWith("__")) {
      continue;
    }

    if (
      ttype instanceof GraphQLScalarType ||
      ttype instanceof GraphQLEnumType
    ) {
      if (ttype.extensions?.["isPublic"] === true) {
        publicTypeNames.add(ttype.name);
      }
    } else if (ttype instanceof GraphQLUnionType) {
      if (ttype.extensions?.["isPublic"] === true) {
        publicTypeNames.add(ttype.name);
        unionTypes.add(ttype);
      }
    } else if (
      ttype instanceof GraphQLInterfaceType ||
      ttype instanceof GraphQLObjectType
    ) {
      const isTypePublic = ttype.extensions?.["isPublic"] === true;
      const fields = ttype.getFields();
      const isAnyFieldPublic = !!Array.from(Object.values(fields)).find(
        (field) => !!field.extensions?.["isPublic"]
      );
      if (isTypePublic === true || isAnyFieldPublic === true) {
        publicTypeNames.add(ttype.name);
        interfaceTypes.set(
          ttype.name,
          ttype.getInterfaces().map((inter) => inter.name)
        );

        for (const field of Object.values(fields)) {
          const isFieldPublic = field.extensions?.["isPublic"] === true;
          if (isFieldPublic === true || isTypePublic === true) {
            publicFieldReturnTypes.set(
              `${ttype.name}.${field.name}`,
              getWrappedType(field.type).name
            );
            if (field.args.length > 0) {
              publicFieldArgumentTypes.set(
                `${ttype.name}.${field.name}`,
                field.args.map((arg) => getWrappedType(arg.type).name)
              );
            }
          }
        }
      }
    } else if (ttype instanceof GraphQLInputObjectType) {
      const fields = ttype.getFields();
      const isTypePublic = ttype.extensions?.["isPublic"] === true;
      const isAnyFieldPublic = !!Array.from(Object.values(fields)).find(
        (field) => field.extensions?.["isPublic"] === true
      );

      if (isTypePublic === true || isAnyFieldPublic === true) {
        publicTypeNames.add(ttype.name);

        for (const field of Object.values(fields)) {
          const isFieldPublic = field.extensions?.["isPublic"] === true;
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

  return mapSchema(schema, {
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
          newFields[name] = fieldConfig;
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

const hasTypePublicDirective = (ttype: GraphQLNamedType) =>
  !!ttype.astNode?.directives?.find(
    (directive) => directive.name.value === "public"
  );

/**
 * Maps input schema and translates @public usages to extensions.isPublic fields.
 */
export const directiveToExtensionsTransform = (
  schema: GraphQLSchema
): GraphQLSchema => {
  const typeMap = new Map<string, GraphQLNamedType>();
  const getNewType = (ttype: GraphQLType): GraphQLType => {
    if (ttype instanceof GraphQLList) {
      return new GraphQLList(getNewType(ttype.ofType));
    }
    if (ttype instanceof GraphQLNonNull) {
      return new GraphQLNonNull(getNewType(ttype.ofType));
    }
    const newType = typeMap.get(ttype.name);
    if (!newType) {
      throw new Error(`${ttype.name} counter-part does not exist :(`);
    }
    return newType;
  };

  return mapSchema(schema, {
    [MapperKind.OBJECT_TYPE]: (ttype) => {
      const isPublic = hasTypePublicDirective(ttype);
      const config = ttype.toConfig();
      config.extensions = { ...ttype.extensions, isPublic };
      const newType = new GraphQLObjectType(config);
      typeMap.set(newType.name, newType);
      return newType;
    },
    [MapperKind.INPUT_OBJECT_TYPE]: (ttype) => {
      const isPublic = hasTypePublicDirective(ttype);
      const config = ttype.toConfig();
      config.extensions = { ...ttype.extensions, isPublic };
      const newType = new GraphQLInputObjectType(config);
      typeMap.set(newType.name, newType);
      return newType;
    },
    [MapperKind.UNION_TYPE]: (ttype) => {
      const isPublic = hasTypePublicDirective(ttype);
      const config = ttype.toConfig();
      config.extensions = { ...ttype.extensions, isPublic };
      const newType = new GraphQLUnionType(config);
      typeMap.set(newType.name, newType);
      return newType;
    },
    [MapperKind.INTERFACE_TYPE]: (ttype) => {
      const isPublic = hasTypePublicDirective(ttype);
      const config = ttype.toConfig();
      config.extensions = { ...ttype.extensions, isPublic };
      const newType = new GraphQLInterfaceType(config);
      typeMap.set(newType.name, newType);
      return newType;
    },
    [MapperKind.SCALAR_TYPE]: (ttype) => {
      if (builtInTypes.has(ttype.name)) {
        typeMap.set(ttype.name, ttype);
        return ttype;
      }
      const isPublic = hasTypePublicDirective(ttype);
      const config = ttype.toConfig();
      config.extensions = { ...ttype.extensions, isPublic };
      const newType = new GraphQLScalarType(config);
      typeMap.set(newType.name, newType);
      return newType;
    },
    [MapperKind.ENUM_TYPE]: (ttype) => {
      const isPublic = hasTypePublicDirective(ttype);
      const config = ttype.toConfig();
      config.extensions = { ...ttype.extensions, isPublic };
      const newType = new GraphQLEnumType(config);
      typeMap.set(newType.name, newType);
      return newType;
    },
    [MapperKind.INPUT_OBJECT_FIELD]: (field) => {
      const isPublic = !!field.astNode?.directives?.find(
        (directive) => directive.name.value === "public"
      );

      return {
        ...field,
        extensions: { ...field.extensions, isPublic },
        type: getNewType(field.type) as GraphQLInputType,
      };
    },
    [MapperKind.OBJECT_FIELD]: (field) => {
      const isPublic = !!field.astNode?.directives?.find(
        (directive) => directive.name.value === "public"
      );
      return {
        ...field,
        extensions: { ...field.extensions, isPublic },
        type: getNewType(field.type) as GraphQLOutputType,
      };
    },
    [MapperKind.ARGUMENT]: (arg) => {
      const isPublic = !!arg.astNode?.directives?.find(
        (directive) => directive.name.value === "public"
      );

      return {
        ...arg,
        extensions: { ...arg.extensions, isPublic },
        type: getNewType(arg.type) as GraphQLInputType,
      };
    },
  });
};
