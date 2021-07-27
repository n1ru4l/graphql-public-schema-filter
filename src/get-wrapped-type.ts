import { GraphQLList, GraphQLNonNull, GraphQLType } from "graphql";

export const getWrappedType = (
  graphqlType: GraphQLType
): Exclude<GraphQLType, GraphQLList<any> | GraphQLNonNull<any>> => {
  if (
    graphqlType instanceof GraphQLList ||
    graphqlType instanceof GraphQLNonNull
  ) {
    return getWrappedType(graphqlType.ofType);
  }
  return graphqlType;
};
