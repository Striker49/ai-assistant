import fs from "fs";
import { exec } from "child_process";

export const tools = {
  open_vscode: {
    description: "Open Visual Studio Code",
    execute: async () => {
      exec("code");
      return "VS Code opened.";
    },
  },

open_file: {
    description: "Open a text file from disk",
    execute: async ({ path }) => {
      if (!fs.existsSync(path)) {
        return `File not found: ${path}`;
      }
      return exec("code");;
    },
  },

  read_file: {
    description: "Read a text file from disk",
    execute: async ({ path }) => {
      if (!fs.existsSync(path)) {
        return `File not found: ${path}`;
      }
      return fs.readFileSync(path, "utf-8");
    },
  },

  write_file: {
    description: "Write text content to a file",
    execute: async ({ path, content }) => {
      fs.writeFileSync(path, content, "utf-8");
      return `Wrote file: ${path}`;
    },
  },

  list_files: {
    description: "List files in a directory",
    execute: async ({ path }) => {
      if (!fs.existsSync(path)) {
        return `Directory not found: ${path}`;
      }
      return JSON.stringify(fs.readdirSync(path), null, 2);
    },
  },
};