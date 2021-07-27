import {
  BuildContextArgs,
  CreateApp,
  InferContext,
  useLazyLoadedSchema,
  useSchema,
} from "@graphql-ez/koa";
import { privateSchema, publicSchema } from "./schema";
import { ezGraphiQLIDE } from "@graphql-ez/plugin-graphiql";

declare module "graphql-ez" {
  interface EZContext extends InferContext<typeof buildContext> {}
}

function buildContext({ req, koa }: BuildContextArgs) {
  return {
    role: (koa?.request.header?.["authorization"] ?? "public") as
      | "public"
      | "private",
  };
}

export const ezApp = CreateApp({
  ez: {
    plugins: [
      ezGraphiQLIDE({
        headers: JSON.stringify(
          {
            Authorization: "public",
          },
          null,
          2
        ),
      }),
    ],
  },
  buildContext,
  envelop: {
    plugins: [
      useSchema(publicSchema),
      useLazyLoadedSchema((context) =>
        context?.role === "private" ? privateSchema : publicSchema
      ),
    ],
  },
});
