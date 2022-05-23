import { createServer, useLazyLoadedSchema } from "@graphql-yoga/node";
import { privateSchema, publicSchema } from "./schema";

const port = 8080 as const;

const server = createServer({
  schema: publicSchema,
  plugins: [
    useLazyLoadedSchema((context) =>
      (context?.request as any).headers.get("authorization") === "private"
        ? privateSchema
        : publicSchema
    ),
  ],
  graphiql: {
    headers: JSON.stringify(
      {
        Authorization: "public",
      },
      null,
      2
    ),
  },
  port,
});

server.start();
