import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLType,
  GraphQLUnionType,
} from "graphql";

export const getWrappedType = (
  graphqlType: GraphQLType
):
  | GraphQLScalarType
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | GraphQLObjectType<any, any>
  | GraphQLInterfaceType
  | GraphQLUnionType
  | GraphQLEnumType
  | GraphQLInputObjectType => {
  if (
    graphqlType instanceof GraphQLList ||
    graphqlType instanceof GraphQLNonNull
  ) {
    return getWrappedType(graphqlType.ofType);
  }
  return graphqlType;
};
