import { createYoga } from "graphql-yoga";
import { privateSchema, publicSchema } from "./schema";

export const yoga = createYoga({
  schema: (r) =>
    (r.request.headers.get("authorization") ?? "public") === "private"
      ? privateSchema
      : publicSchema,
});
