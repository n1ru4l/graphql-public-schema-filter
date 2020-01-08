#!/usr/bin/env node
import path from "path";
import fs from "fs";
import pkg from "../../package.json";
import { filterSchemaDefinitionPerRole } from "../filter-schema-definition-per-role";

console.log(`@n1ru4l/graphql-schema-filter v${pkg.version}`);

const [, , command = "help"] = process.argv;
switch (command) {
  case "help":
  case "--help":
  case "-h": {
    console.log(`\nUsage:\n\n  filter-graphql-schema <file-path>\n`);
    break;
  }
  default: {
    let filePath = command;
    if (!path.isAbsolute(command)) {
      const cwd = process.cwd();
      filePath = path.join(cwd, filePath);
    }
    try {
      const stats = fs.statSync(filePath);
      if (!stats.isFile) {
        const errorMessage = `Path '${filePath}' is not a file.`;
        console.error(`\n ${errorMessage}`);
        throw new Error(errorMessage);
      }
    } catch (err) {
      if (err.code === "ENOENT") {
        const errorMessage = `Path '${filePath}' could not be found.`;
        console.error(`\n${errorMessage}`);
        throw new Error(errorMessage);
      }
      throw err;
    }

    const fileName = path.basename(filePath, ".gql");
    const directoryName = path.dirname(filePath);

    const fileContents = fs.readFileSync(filePath, "utf-8");
    const schemaPerRole = filterSchemaDefinitionPerRole(fileContents);
    for (const [role, schemaDefinition] of Object.entries(schemaPerRole)) {
      const roleFileName = `${fileName}.${role}.gql`;
      console.log(`Writing schema for role '${role}' to '${roleFileName}'.`);
      fs.writeFileSync(
        path.join(directoryName, `${fileName}.${role}.gql`),
        schemaDefinition
      );
    }
  }
}
