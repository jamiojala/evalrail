import { join } from "node:path";

import { config } from "dotenv";

export function loadExampleEnvironment(directory = process.cwd()): void {
  config({
    path: [join(directory, ".env.local"), join(directory, ".env")],
    quiet: true
  });
}
