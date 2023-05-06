import { yoga } from "./yoga";
import { createServer } from "http";

const port = 8080;

createServer(yoga).listen(port, () => {
  console.log(
    `GraphQL Server listening on port http://127.0.0.1:${port}/graphql`
  );
});
