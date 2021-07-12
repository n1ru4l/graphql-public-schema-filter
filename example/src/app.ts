import { CreateApp, useSchema } from "@graphql-ez/koa";
import { privateSchema, publicSchema } from "./schema";
import { ezGraphiQLIDE } from "@graphql-ez/plugin-graphiql";

export const ezApp = CreateApp({
  ez: {
    plugins: [ezGraphiQLIDE()],
  },
  envelop: {
    plugins: [useSchema(publicSchema)],
  },
});
