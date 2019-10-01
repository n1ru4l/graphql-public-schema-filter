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
  InputValueDefinitionNode,
  DirectiveNode,
  ScalarTypeDefinitionNode,
  EnumTypeDefinitionNode,
  UnionTypeDefinitionNode,
  ArgumentNode,
  isInputObjectType,
  GraphQLInputType,
  isListType,
  isNonNullType,
  GraphQLList,
  GraphQLNonNull
} from "graphql";

const BASIC_TYPES = [
  "String",
  "Int",
  "Float",
  "Boolean",
  "Query",
  "Mutation",
  "ID"
];

export interface CreateDirectiveTypeDefs {
  directiveName?: string;
  roleArgumentName?: string;
  roleType?: string;
}

export const createPublicDirectiveTypeDefs = (
  options?: CreateDirectiveTypeDefs
): string => {
  const directiveName = (options && options.directiveName) || "public";
  const roleArgumentName = (options && options.roleArgumentName) || "roles";
  const roleType = (options && options.roleType) || "String";

  return /* GraphQL */ `
    directive @${directiveName}(
      ${roleArgumentName}: [${roleType}!]
    ) on OBJECT | FIELD_DEFINITION | ENUM | UNION | INTERFACE | INPUT_OBJECT | SCALAR
  `;
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

const getWrappedInputType = (type: GraphQLInputType) => {
  if (isListType(type) || isNonNullType(type)) {
    return type.ofType as Exclude<
      GraphQLInputType,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      GraphQLNonNull<any> | GraphQLList<any>
    >;
  }
  return type;
};

const colorYellow = "\x1b[33m";
const colorReset = "\x1b[0m";

export type Reporter = (message: string) => void;

const defaultReporter: Reporter = (text: string) =>
  console.warn(
    `${colorYellow}[public-introspection-filter]: ${text}${colorReset}`
  );

export type GetRoleFromContext = (
  graphqlContext: unknown
) => string | null | void;

export interface MakePublicIntrospectionFilterOptions {
  reporter?: Reporter;
  getRoleFromContext?: GetRoleFromContext;
  directiveName?: string;
  directiveArgumentName?: string;
}

interface RoleContext {
  publicTypeNames: Set<string>;
  publicFieldReturnTypes: Map<string, string>;
  publicFieldArgumentTypes: Map<string, string[]>;
  unionTypes: Map<string, string[]>;
  inputTypes: Set<string>;
  interfaceTypes: Map<string, string[]>;
  allAvailableFields: Set<string>;
}

const createRoleContext = (): RoleContext => ({
  publicTypeNames: new Set(BASIC_TYPES),
  publicFieldReturnTypes: new Map(),
  publicFieldArgumentTypes: new Map(),
  unionTypes: new Map(),
  interfaceTypes: new Map(),
  inputTypes: new Set(),
  allAvailableFields: new Set()
});

const DEFAULT_ACCESS_IDENTIFIER = "DEFAULT";

type GraphQLTypeObject =
  | ObjectTypeExtensionNode
  | ObjectTypeDefinitionNode
  | InterfaceTypeDefinitionNode
  | InputObjectTypeDefinitionNode
  | InputObjectTypeExtensionNode;

type ExecActionForRoleContextFunction = (roleContext: RoleContext) => void;

export const makePublicIntrospectionFilter = (
  schema: GraphQLSchema,
  typeDefs: string,
  options?: MakePublicIntrospectionFilterOptions
): { schema: GraphQLSchema; roles: string[] } => {
  const reporter = (options && options.reporter) || defaultReporter;
  const reports: string[] = [];

  const getRoleFromContext =
    (options && options.getRoleFromContext) ||
    (() => DEFAULT_ACCESS_IDENTIFIER);
  const directiveName = (options && options.directiveName) || "public";
  const directiveArgumentName = (options && options.directiveName) || "roles";

  const findAllDirectivesForField = (
    field: FieldDefinitionNode | InputValueDefinitionNode
  ) =>
    field.directives
      ? field.directives.filter(
          directive => directive.name.value === directiveName
        )
      : [];

  const findAllObjectDirectives = (
    object:
      | GraphQLTypeObject
      | ScalarTypeDefinitionNode
      | EnumTypeDefinitionNode
      | UnionTypeDefinitionNode
  ) =>
    object.directives
      ? object.directives.filter(
          directive => directive.name.value === directiveName
        )
      : [];

  const findAllObjectFieldDirectives = (
    object: GraphQLTypeObject
  ): DirectiveNode[] =>
    Array.isArray(object.fields)
      ? object.fields
          .map(findAllDirectivesForField)
          .reduce((res, directives) => {
            res.push(...directives);
            return res;
          }, [])
      : [];

  const roleSchemaAccess = new Map<string, RoleContext>();

  const getOrCreateRoleSchemaAccess = (identifier: string): RoleContext => {
    let roleSchema = roleSchemaAccess.get(identifier);
    if (!roleSchema) {
      roleSchema = createRoleContext();
      roleSchemaAccess.set(identifier, roleSchema);
    }
    return roleSchema;
  };

  const getRoleAttribute = (directive: DirectiveNode): ArgumentNode =>
    Array.isArray(directive.arguments)
      ? directive.arguments.find(
          (argument: ArgumentNode) =>
            argument.name.value === directiveArgumentName &&
            argument.value.kind === "ListValue" &&
            (argument.value.values.every(
              value => value.kind === "StringValue"
            ) ||
              argument.value.values.every(value => value.kind === "EnumValue"))
        )
      : null;

  const runActionForRoleDirective = (
    directive: DirectiveNode,
    execActionForRoleContext: ExecActionForRoleContextFunction
  ) => {
    const roleAttribute = getRoleAttribute(directive);

    if (
      roleAttribute &&
      roleAttribute.value.kind === "ListValue" &&
      roleAttribute.value.values.length
    ) {
      for (const roleAttributeValue of roleAttribute.value.values) {
        if (
          roleAttributeValue.kind === "StringValue" ||
          roleAttributeValue.kind === "EnumValue"
        ) {
          const roleContext = getOrCreateRoleSchemaAccess(
            roleAttributeValue.value
          );
          execActionForRoleContext(roleContext);
        }
      }
    } else {
      const roleContext = getOrCreateRoleSchemaAccess(
        DEFAULT_ACCESS_IDENTIFIER
      );
      execActionForRoleContext(roleContext);
    }
  };

  const runActionForRoleDirectives = (
    directives: DirectiveNode[],
    execActionForRoleContext: ExecActionForRoleContextFunction
  ) => {
    for (const directive of directives) {
      runActionForRoleDirective(directive, execActionForRoleContext);
    }
  };
  const ast = parse(typeDefs);

  const allInputTypes = new Set<string>();

  const handleObject = (
    type:
      | ObjectTypeExtensionNode
      | ObjectTypeDefinitionNode
      | InterfaceTypeDefinitionNode
      | InputObjectTypeDefinitionNode
      | InputObjectTypeExtensionNode,
    isInputType = false
  ) => {
    const objectDirectives = findAllObjectDirectives(type);
    const objectFieldDirectives = findAllObjectFieldDirectives(type);
    const objectAndObjectFieldDirectives = [
      ...objectDirectives,
      ...objectFieldDirectives
    ];

    if (objectAndObjectFieldDirectives.length) {
      runActionForRoleDirectives(
        objectAndObjectFieldDirectives,
        roleContext => {
          roleContext.publicTypeNames.add(type.name.value);
        }
      );

      if (
        (type.kind === "ObjectTypeDefinition" ||
          type.kind === "ObjectTypeExtension") &&
        type.interfaces
      ) {
        runActionForRoleDirectives(
          objectAndObjectFieldDirectives,
          roleContext => {
            if (!type.interfaces) return;
            roleContext.interfaceTypes.set(
              type.name.value,
              type.interfaces.map(inter => inter.name.value)
            );
          }
        );
      }

      visit(type, {
        InputValueDefinition: {
          enter: (field /*, key, parent, path*/) => {
            const fieldPublicDirectives = findAllDirectivesForField(field);
            if (objectDirectives.length || fieldPublicDirectives.length) {
              allInputTypes.add(getWrappedTypeName(field.type));
            }
          }
        },
        FieldDefinition: {
          enter: (field /*, key, parent, path*/) => {
            const fieldPublicDirectives = findAllDirectivesForField(field);

            if (isInputType) {
              allInputTypes.add(getWrappedTypeName(field.type));
            }

            runActionForRoleDirectives(
              fieldPublicDirectives.length === 0
                ? objectDirectives
                : fieldPublicDirectives,
              roleContext => {
                roleContext.publicFieldReturnTypes.set(
                  `${type.name.value}.${field.name.value}`,
                  getWrappedTypeName(field.type)
                );

                if (field.arguments) {
                  const types = field.arguments.map(argument =>
                    getWrappedTypeName(argument.type)
                  );
                  roleContext.publicFieldArgumentTypes.set(
                    `${type.name.value}.${field.name.value}`,
                    types
                  );
                }
              }
            );
          }
        }
      });
    }

    return false;
  };

  visit(ast, {
    ScalarTypeDefinition: {
      enter: scalar => {
        const scalarDirectiveNodes = findAllObjectDirectives(scalar);
        runActionForRoleDirectives(scalarDirectiveNodes, roleContext => {
          roleContext.publicTypeNames.add(scalar.name.value);
        });
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
        const typeDirectiveNodes = findAllObjectDirectives(type);
        runActionForRoleDirectives(typeDirectiveNodes, roleContext => {
          roleContext.publicTypeNames.add(type.name.value);
        });
        return false;
      }
    },
    UnionTypeDefinition: {
      enter: type => {
        const unionDirectives = findAllObjectDirectives(type);
        runActionForRoleDirectives(unionDirectives, roleContext => {
          roleContext.publicTypeNames.add(type.name.value);
          if (type.types) {
            roleContext.unionTypes.set(
              type.name.value,
              type.types.map(type => type.name.value)
            );
          }
        });

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
        allInputTypes.add(type.name.value);
        return handleObject(type, true);
      }
    },
    InputObjectTypeExtension: {
      enter: type => {
        allInputTypes.add(type.name.value);
        return handleObject(type, true);
      }
    }
  });

  for (const [roleName, context] of roleSchemaAccess.entries()) {
    reports.push(`VALIDATION FOR ROLE "${roleName}"`);

    context.allAvailableFields = new Set(context.publicFieldReturnTypes.keys());

    // check availablity of union types
    for (const [unionType, dependecyTypes] of context.unionTypes) {
      for (const dependecyType of dependecyTypes) {
        if (!context.publicTypeNames.has(dependecyType)) {
          context.publicTypeNames.delete(unionType);
          reports.push(
            `Type "${dependecyType}" is not marked as public.\n` +
              ` -> The union "${unionType}" will not be marked as visible.`
          );
        }
      }
    }

    // check availability of interface types
    for (const [type, implementedInterfaces] of context.interfaceTypes) {
      for (const interfaceName of implementedInterfaces) {
        if (!context.publicTypeNames.has(interfaceName)) {
          context.publicTypeNames.delete(type);
          reports.push(
            `Interface "${interfaceName}" is not marked as public.\n` +
              ` -> The type "${type}" which implements the interface will not be marked as visible.`
          );
        }
      }
    }

    const filterInputTypes = (remainingInputTypes: Set<string>) => {
      for (const inputTypeName of remainingInputTypes) {
        const type = schema.getType(inputTypeName);
        if (!type) {
          throw new Error("Invaid state.");
        }

        if (isInputObjectType(type)) {
          const fields = type.getFields();

          const namesOfReferencesThatAreNotPublic = Object.values(fields)
            .map(field => getWrappedInputType(field.type))
            .filter(isInputObjectType)
            .map(type => type.name)
            .filter(name => !context.publicTypeNames.has(name));

          if (namesOfReferencesThatAreNotPublic.length) {
            let firstLine = `The type "${namesOfReferencesThatAreNotPublic[0]}" is not public`;

            if (namesOfReferencesThatAreNotPublic.length > 1) {
              firstLine = `The type(s) ${namesOfReferencesThatAreNotPublic
                .map(name => `"${name}"`)
                .join(", ")} are not public`;
            }
            reports.push(
              `${firstLine}, but referenced by the input type "${type.name}".\n` +
                ` -> The input type "${type}" will not be marked as visible.`
            );

            if (context.publicTypeNames.delete(type.name)) {
              const clone = new Set(remainingInputTypes);
              clone.delete(type.name);
              filterInputTypes(clone);
            }
          }
        }
      }
    };

    filterInputTypes(new Set(allInputTypes));

    // check availability of fields
    for (const [fieldPath, returnType] of context.publicFieldReturnTypes) {
      if (!context.publicTypeNames.has(returnType)) {
        reports.push(
          `Type "${returnType}" is not marked as public.\n` +
            ` -> The field "${fieldPath}" will not be marked as visible.`
        );
        context.allAvailableFields.delete(fieldPath);
      }
    }

    // check availability of input arguments
    for (const [fieldPath, inputTypes] of context.publicFieldArgumentTypes) {
      for (const inputType of inputTypes) {
        if (!context.publicTypeNames.has(inputType)) {
          reports.push(
            `Input Type "${inputType}" is not marked as public but referenced by the field "${fieldPath}"\n` +
              ` -> The field "${fieldPath}" will not be marked as visible.`
          );
          context.allAvailableFields.delete(fieldPath);
        }
      }
    }
  }

  const filteredSchema = makeFilteredSchema(schema, {
    type: [
      (type, root, args, graphqlContext) => {
        const role =
          getRoleFromContext(graphqlContext) || DEFAULT_ACCESS_IDENTIFIER;
        const context = getOrCreateRoleSchemaAccess(role);
        return context.publicTypeNames.has(type.name);
      }
    ],
    directive: [directive => directive.name !== directiveName],
    field: [
      (field, root, args, graphqlContext) => {
        const role =
          getRoleFromContext(graphqlContext) || DEFAULT_ACCESS_IDENTIFIER;
        const context = getOrCreateRoleSchemaAccess(role);
        return context.allAvailableFields.has(`${root.name}.${field.name}`);
      }
    ]
  });

  const roles = Array.from(roleSchemaAccess.keys());

  for (const message of reports) {
    reporter(message);
  }

  return { schema: filteredSchema, roles };
};
