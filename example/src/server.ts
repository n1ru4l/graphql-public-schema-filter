import Koa from "koa";
import KoaRouter from "@koa/router";

import { ezApp } from "./app";

const app = new Koa();

const router = new KoaRouter();

ezApp
  .buildApp({
    app,
    router,
  })
  .then(() => {
    app.use(router.routes()).use(router.allowedMethods());

    const port = 8080;
    app.listen(port, () => {
      console.log(
        `GraphQL Server listening on port http://127.0.0.1:${port}/graphql`
      );
    });
  });
