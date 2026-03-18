import fs from "fs";
import path from "path";
import { exec } from "child_process";

function openWithSystem(target) {
  return new Promise((resolve, reject) => {
    let command;

    if (process.platform === "win32") {
      command = `start "" "${target}"`;
      exec(command, { shell: "cmd.exe" }, (err) => {
        if (err) return reject(err);
        resolve(`Opened: ${target}`);
      });
    } else if (process.platform === "darwin") {
      command = `open "${target}"`;
      exec(command, (err) => {
        if (err) return reject(err);
        resolve(`Opened: ${target}`);
      });
    } else {
      command = `xdg-open "${target}"`;
      exec(command, (err) => {
        if (err) return reject(err);
        resolve(`Opened: ${target}`);
      });
    }
  });
}

function searchInFilesRecursive(basePath, searchQuery, results = []) {
  const entries = fs.readdirSync(basePath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(basePath, entry.name);

    if (entry.isDirectory()) {
      searchInFilesRecursive(fullPath, searchQuery, results);
      continue;
    }

    if (!entry.isFile()) continue;

    try {
      const content = fs.readFileSync(fullPath, "utf-8");

      if (content.toLowerCase().includes(searchQuery.toLowerCase())) {
        results.push(fullPath);
      }
    } catch (err) {
      console.error("ERROR: ", err);
    }
  }

  return results;
}

export const toolPermissions = {
  open_vscode: "auto",
  open_browser: "auto",
  open_folder: "auto",
  read_file: "auto",
  list_files: "auto",
  search_files: "auto",
  write_file: "confirm",
  append_file: "confirm",
};

export const tools = {
  open_vscode: {
    description: "Open Visual Studio Code",
    execute: async () => {
      return new Promise((resolve, reject) => {
        exec("code", (err) => {
          if (err) return reject(err);
          resolve("VS Code opened.");
        });
      });
    },
  },

  open_browser: {
    description: "Open a website in the default browser",
    execute: async ({ url }) => {
      if (!url) throw new Error("Missing url.");
      return await openWithSystem(url);
    },
  },

  open_folder: {
    description: "Open a folder in the file explorer",
    execute: async ({ path: folderPath }) => {
      if (!folderPath) throw new Error("Missing path.");
      if (!fs.existsSync(folderPath)) {
        throw new Error(`Folder not found: ${folderPath}`);
      }

      return await openWithSystem(folderPath);
    },
  },

  read_file: {
    description: "Read a text file from disk",
    execute: async ({ path: filePath }) => {
      if (!filePath) throw new Error("Missing path.");
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      return fs.readFileSync(filePath, "utf-8");
    },
  },

  write_file: {
    description: "Write text to a file",
    execute: async ({ path: filePath, content }) => {
      if (!filePath) throw new Error("Missing path.");
      if (content === undefined) throw new Error("Missing content.");

      fs.writeFileSync(filePath, content, "utf-8");
      return `File written: ${filePath}`;
    },
  },

  append_file: {
    description: "Append text to a file",
    execute: async ({ path: filePath, content }) => {
      if (!filePath) throw new Error("Missing path.");
      if (content === undefined) throw new Error("Missing content.");

      fs.appendFileSync(filePath, content, "utf-8");
      return `Content appended to: ${filePath}`;
    },
  },

  list_files: {
    description: "List files in a directory",
    execute: async ({ path: dirPath }) => {
      if (!dirPath) throw new Error("Missing path.");
      if (!fs.existsSync(dirPath)) {
        throw new Error(`Directory not found: ${dirPath}`);
      }

      const files = fs.readdirSync(dirPath);
      return JSON.stringify(files, null, 2);
    },
  },

  search_files: {
    description: "Search for text inside files in a directory",
    execute: async ({ path: dirPath, query }) => {
      if (!dirPath) throw new Error("Missing path.");
      if (!query) throw new Error("Missing query.");
      if (!fs.existsSync(dirPath)) {
        throw new Error(`Directory not found: ${dirPath}`);
      }

      const matches = searchInFilesRecursive(dirPath, query);
      if (matches.length === 0) {
        return `No files found containing "${query}".`;
      }

      return JSON.stringify(matches, null, 2);
    },
  },
};