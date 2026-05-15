import { defineCommand, runMain } from "citty";
import { discoverCommand } from "./discover.js";

const main = defineCommand({
  meta: {
    name: "zoutex",
    version: "0.1.0",
    description: "ZouteX CLI tools for Next.js App Router routes",
  },
  subCommands: {
    discover: discoverCommand,
  },
});

runMain(main);
