#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Ajv from "ajv";
import addFormats from "ajv-formats";

async function main() {
  try {
    const rootDir = path.resolve(
      path.join(path.dirname(new URL(import.meta.url).pathname), "..")
    );
    const serverJsonPath = path.join(rootDir, "server.json");
    if (!fs.existsSync(serverJsonPath)) {
      console.error("server.json not found at project root");
      process.exit(1);
    }

    const serverJson = JSON.parse(fs.readFileSync(serverJsonPath, "utf8"));
    const schemaUrl = serverJson.$schema;
    if (!schemaUrl || typeof schemaUrl !== "string") {
      console.error("Missing or invalid $schema field in server.json");
      process.exit(1);
    }

    const res = await fetch(schemaUrl);
    if (!res.ok) {
      console.error(
        `Failed to fetch schema from ${schemaUrl}: ${res.status} ${res.statusText}`
      );
      process.exit(1);
    }
    const schema = await res.json();

    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    const valid = validate(serverJson);
    if (!valid) {
      console.error("server.json failed schema validation:");
      for (const err of validate.errors ?? []) {
        console.error(`- ${err.instancePath || "(root)"} ${err.message}`);
      }
      process.exit(1);
    }

    console.log("server.json is valid against the schema.");
  } catch (err) {
    console.error(
      "Validation failed with an unexpected error:",
      err instanceof Error ? err.message : String(err)
    );
    process.exit(1);
  }
}

main();

