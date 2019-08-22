import makeFilteredSchema from "graphql-introspection-filtering";
import {
  GraphQLSchema,
  visit,
  FieldDefinitionNode,
  Kind,
  TypeNode,
  parse,
  ObjectTypeExtensionNode,
  ObjectTypeDefinitionNode,
  InterfaceTypeDefinitionNode,
  InputObjectTypeDefinitionNode,
  InputObjectTypeExtensionNode,
  InputValueDefinitionNode
} from "graphql";

const colorYellow = "\x1b[33m";
const colorReset = "\x1b[0m";

export type Reporter = (message: string) => void;

const defaultReporter: Reporter = (text: string) =>
  console.warn(`${colorYellow}${text}${colorReset}`);

const BASIC_TYPES = [
  "String",
  "Int",
  "Float",
  "Boolean",
  "Query",
  "Mutation",
  "ID"
];

const fieldHasPublicDirective = (
  field: FieldDefinitionNode | InputValueDefinitionNode
) => {
  return (
    field.directives &&
    field.directives.some(directive => directive.name.value === "public")
  );
};

/**
 * e.g.
 * [ID]! -> ID
 * String! -> String
 * [ID!]! -> ID
 * ID -> ID
 */
const getWrappedTypeName = (type: TypeNode): string => {
  switch (type.kind) {
    case Kind.LIST_TYPE:
    case Kind.NON_NULL_TYPE:
      return getWrappedTypeName(type.type);
    case Kind.NAMED_TYPE: {
      return type.name.value;
    }
  }
  throw new TypeError("Invalid input");
};

interface MakePublicIntrospectionFilterOptions {
  reporter: Reporter;
}

export const makePublicIntrospectionFilter = (
  schema: GraphQLSchema,
  typeDefs: string,
  options?: MakePublicIntrospectionFilterOptions
): GraphQLSchema => {
  const reporter = (options && options.reporter) || defaultReporter;

  const publicTypeNames: Set<string> = new Set(BASIC_TYPES);
  const publicFieldReturnTypes: Map<string, string> = new Map();
  const publicFieldArgumentTypes: Map<string, string[]> = new Map();
  const unionTypes: Map<string, string[]> = new Map();
  const interfaceTypes: Map<string, string[]> = new Map();

  const ast = parse(typeDefs);

  const handleObject = (
    type:
      | ObjectTypeExtensionNode
      | ObjectTypeDefinitionNode
      | InterfaceTypeDefinitionNode
      | InputObjectTypeDefinitionNode
      | InputObjectTypeExtensionNode
  ) => {
    const isObjectPublic =
      type.directives &&
      type.directives.some(directive => directive.name.value === "public");

    const isAnyFieldPublic =
      type.fields && type.fields.some(fieldHasPublicDirective);

    if (isObjectPublic || isAnyFieldPublic) {
      publicTypeNames.add(type.name.value);

      if (
        (type.kind === "ObjectTypeDefinition" ||
          type.kind === "ObjectTypeExtension") &&
        type.interfaces
      ) {
        interfaceTypes.set(
          type.name.value,
          type.interfaces.map(inter => inter.name.value)
        );
      }

      visit(type, {
        InputValueDefinition: {
          enter: (field /*, key, parent, path*/) => {
            if (isObjectPublic || fieldHasPublicDirective(field)) {
              publicFieldReturnTypes.set(
                `${type.name.value}.${field.name.value}`,
                getWrappedTypeName(field.type)
              );
            }
          }
        },
        FieldDefinition: {
          enter: (field /*, key, parent, path*/) => {
            if (isObjectPublic || fieldHasPublicDirective(field)) {
              publicFieldReturnTypes.set(
                `${type.name.value}.${field.name.value}`,
                getWrappedTypeName(field.type)
              );
              if (field.arguments) {
                publicFieldArgumentTypes.set(
                  `${type.name.value}.${field.name.value}`,
                  field.arguments.map(argument =>
                    getWrappedTypeName(argument.type)
                  )
                );
              }
            }
          }
        }
      });
    }

    return false;
  };

  visit(ast, {
    ScalarTypeDefinition: {
      enter: scalar => {
        if (
          scalar.directives &&
          scalar.directives.some(directive => directive.name.value === "public")
        ) {
          publicTypeNames.add(scalar.name.value);
        }
      }
    },
    ObjectTypeExtension: {
      enter: type => {
        return handleObject(type);
      }
    },
    ObjectTypeDefinition: {
      enter: type => {
        return handleObject(type);
      }
    },
    EnumTypeDefinition: {
      enter: type => {
        if (
          type.directives &&
          type.directives.some(directive => directive.name.value === "public")
        ) {
          publicTypeNames.add(type.name.value);
        }

        return false;
      }
    },
    UnionTypeDefinition: {
      enter: type => {
        if (
          type.directives &&
          type.directives.some(directive => directive.name.value === "public")
        ) {
          publicTypeNames.add(type.name.value);
          if (type.types) {
            unionTypes.set(
              type.name.value,
              type.types.map(type => type.name.value)
            );
          }
        }

        return false;
      }
    },
    InterfaceTypeDefinition: {
      enter: type => {
        return handleObject(type);
      }
    },
    InputObjectTypeDefinition: {
      enter: type => {
        return handleObject(type);
      }
    },
    InputObjectTypeExtension: {
      enter: type => {
        return handleObject(type);
      }
    }
  });

  const allAvailableFields = new Set(publicFieldReturnTypes.keys());

  // check availablity of union types
  for (const [unionType, dependecyTypes] of unionTypes) {
    for (const dependecyType of dependecyTypes) {
      if (!publicTypeNames.has(dependecyType)) {
        publicTypeNames.delete(unionType);
        reporter(
          `[public-introspection-filter] Type "${dependecyType}" is not marked as public.\n` +
            ` -> The union "${unionType}" will not be marked as visible.`
        );
      }
    }
  }

  // check availability of interface types
  for (const [type, implementedInterfaces] of interfaceTypes) {
    for (const interfaceName of implementedInterfaces) {
      if (!publicTypeNames.has(interfaceName)) {
        publicTypeNames.delete(type);
        reporter(
          `[public-introspection-filter] Interface "${interfaceName}" is not marked as public.\n` +
            ` -> The type "${type}" which implements the interface will not be marked as visible.`
        );
      }
    }
  }

  // check availability of fields
  for (const [fieldPath, returnType] of publicFieldReturnTypes) {
    if (!publicTypeNames.has(returnType)) {
      reporter(
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
  for (const [fieldPath, inputTypes] of publicFieldArgumentTypes) {
    for (const inputType of inputTypes) {
      if (!publicTypeNames.has(inputType)) {
        reporter(
          `[public-introspection-filter] Input Type "${inputType}" is not marked as public.\n` +
            ` -> The field "${fieldPath}" will not be marked as visible.`
        );
        allAvailableFields.delete(fieldPath);
      }
    }

    // @TODO
    // Required input arguments must always be public (or the Input Object type must be public.)
  }

  const filteredSchema = makeFilteredSchema(schema, {
    type: [
      type => {
        return publicTypeNames.has(type.name);
      }
    ],
    directive: [directive => directive.name !== "public"],
    field: [
      (field, root) => {
        return allAvailableFields.has(`${root.name}.${field.name}`);
      }
    ]
  });

  return filteredSchema;
};
