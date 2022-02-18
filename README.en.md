# API Blueprint Language Server

This package allows to enhance developer experience when creating and editing API Blueprint documentation
in code editors and IDE.

## Supported capabilities

* syntax highlighting;
* diagnostic messages;
* breadcrumbs of documentation sections;
* go to definition implementation for data structures and resource prototypes;
* completion of types and structure names.

## Editing of a multi-file documentation

It is common for API documentation to be split into multiple files. Therefore, a developer can define data structures
in one file and use them in another file. In that case, the extension requires the root file to know where to start.
Otherwise, the extension could not realize which data structures are valid and which are not.

By default, the extension assumes that the root file is called `doc.apib` and tries to use it as the entry point.
If no such file is provided, documentation is considered to be single-file.

When the name of the root file differs from `doc.apib`, actual name can be set:
File -> Prefernces -> Settings -> Extensions -> API Blueprint -> Entry Point

If, for some reason, error highlighting is not working, check if the current file is imported directly
in the project root or indirectly.

## Package structure

```text
├── client // Language Client
    └── extension.js // Language Client entry point
├── package.json // The extension manifest.
└── server // Language Server
    └── server.js // Language Server entry point
```

## Development guide

### Launch in dev mode in VS Code

* in the root directory of the extension execute `npm install` command;
* open VS Code;
* switch to Debug viewlet;
* run `Launch Client`;
* open an APIB project or a standalone APIB file;
* run `Attach to Server`.

You can launch client and server at once and select `Client + Server`, but then you need to open required APIB file
quickly, otherwise, the command `Attach to Server` will fail with an error.

### Debugging

To debug server part of the extension breakpoints and logging techniques are applicable.

For logging use `connection.console.log` function. Output results you can find in the `Extension Development Host`
window, in the `Output` section switch to `API Blueprint Language Server`.

## Build extension for VS Code

* in the root directory run `npx vsce package`;
* distribute VSIX package to all who interested in it.

## Language Server in JetBrains IDEs (WebStorm, PhpStorm, etc)

### Add support for Language Server Protocol

To activate LS support install plugin [LSP Support](https://plugins.jetbrains.com/plugin/10209-lsp-support).

The last published version (1.6.1) is quite unstable, and development is suspended for a time.
It is recommended to install version [1.6.0](https://github.com/gtache/intellij-lsp/releases/tag/v1.6.0).

Installation:

1. Download the archive
   [LSP.zip](https://github.com/gtache/intellij-lsp/releases/download/v1.6.0/LSP.zip).
2. Go to plugins list in the IDE settings:
3. Press gear icon (or triple-dot icon) and select «Install Plugin from Disk…».
4. Set path to LSP.zip.

After successful installation, LSP.zip can be deleted.

### Setup LSP Support plugin

To perform required preparations navigate to Preferences → Languages & Frameworks → Language Server Protocol →
[Server Definitions](jetbrains://WebStorm/settings?name=Languages+%26+Frameworks--Language+Server+Protocol--Server+Definitions).

Apply next settings:

1. In the dropdown menu select `Executable`.
2. In the Extension field type `apib`.
3. In the Path specify the full path to the executable `node` file.
4. In the Args field add an argument with the full path to the file [server/server.js](./server/server.js)
   and the second argument with `--stdio` string. Example: `/full/path/to/vscode-apib-ls/server/server.js --stdio`

You can also setup LS globally as an executable file. To do that run `npm link` in the project directory
then make sure that shell command `apibserver` is available.

After that, change value in the Path field to `apibserver` and value in the Args field to `--stdio`.

**Important notice**. After any change, it is recommended to restart IDE.
