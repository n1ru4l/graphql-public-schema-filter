import { DirectiveLocation, GraphQLDirective, print } from "graphql";
import { astFromDirective } from "@graphql-tools/utils";

export const GraphQLPublicDirective = new GraphQLDirective({
  name: "public",
  locations: [
    DirectiveLocation.OBJECT,
    DirectiveLocation.FIELD_DEFINITION,
    DirectiveLocation.ENUM,
    DirectiveLocation.UNION,
    DirectiveLocation.INTERFACE,
    DirectiveLocation.INPUT_OBJECT,
    DirectiveLocation.SCALAR,
    DirectiveLocation.INPUT_FIELD_DEFINITION,
  ],
});

export const publicDirectiveAST = astFromDirective(GraphQLPublicDirective);
export const publicDirectiveSDL = print(publicDirectiveAST);
