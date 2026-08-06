import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { configureApp } from "./app.setup";
import { createOpenApiDocument } from "./openapi";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  configureApp(app);

  // §12 verlangt OpenAPI-dokumentierte Schnittstellen. Die Auslieferung ist beabsichtigt.
  SwaggerModule.setup("api-docs", app, createOpenApiDocument(app));

  const config = app.get(ConfigService);
  const port = config.get<number>("PORT", 3001);

  await app.listen(port, "0.0.0.0");
}

bootstrap().catch((error: unknown) => {
  new Logger("Bootstrap").error(
    "Anwendung konnte nicht gestartet werden",
    error instanceof Error ? error.stack : String(error),
  );
  process.exit(1);
});
