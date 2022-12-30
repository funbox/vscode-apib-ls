# API Blueprint Language Server

This is a VS Code extension that brings a Language Server support for API Blueprint. It adheres to the [Language Server Protocol](https://github.com/Microsoft/language-server-protocol) and allows to enhance developer experience when creating and editing API Blueprint documentation in code editors and IDEs.

[По-русски](./README.ru.md)

## Rationale

Though API Blueprint is based on Markdown, the semantics totally differs from Markdown.
Where in Markdown are sections and titles, in API Blueprint they mean data structures and custom types.

It's easy to misspell the name of a custom data type or get lost among a large number of documentation files.
To help developers with the completion of structure names, navigation between document sections, and other handy stuff,
we created this implementation of Language Server.

## Supported capabilities

* Syntax highlighting.
* Diagnostic messages.
* Breadcrumbs of documentation sections.
* “Go to definition” implementation for data structures and resource prototypes.
* Autocomplete for types and structure names.

## Package structure

```text
├── client            // Language Client
    └── extension.js  // Language Client entry point
├── package.json      // The extension manifest.
└── server            // Language Server
    └── server.js     // Language Server entry point
```

## Installation in VS Code

### Build extension from source

* Run `npx @vscode/vsce package` in the root directory.
* Install packaged extension using the [official guide](https://code.visualstudio.com/docs/editor/extension-marketplace#_install-from-a-vsix);
* Distribute VSIX package to all who interested in it.

### Download from marketplace

VS Code extension is currently unavailable in marketplace.

## Installation in JetBrains IDEs (WebStorm, PhpStorm, etc)

### Add support for Language Server Protocol

To activate LS support install plugin [LSP Support](https://plugins.jetbrains.com/plugin/10209-lsp-support).

The last published version (1.6.1) is quite unstable, and development is suspended for a time.
It is recommended to install version [1.6.0](https://github.com/gtache/intellij-lsp/releases/tag/v1.6.0).

Installation:

1. Download the archive
   [LSP.zip](https://github.com/gtache/intellij-lsp/releases/download/v1.6.0/LSP.zip).
2. Go to plugins list in the IDE settings:
3. Press gear icon (or triple-dot icon) and select “Install Plugin from Disk...”.
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

**Important notice.** After any change, it is recommended to restart IDE.

## Editing of a multi-file documentation

It is common for API documentation to be split into multiple files. Therefore, a developer can define data structures
in one file and use them in another file. In that case, the extension requires the root file to know where to start.
Otherwise, the extension could not realize which data structures are valid and which are not.

By default, the extension assumes that the root file is called `doc.apib` and tries to use it as the entry point.
If no such file is provided, documentation is considered to be single-file.

When the name of the root file differs from `doc.apib`, actual name can be set:
File → Preferences → Settings → Extensions → API Blueprint → Entry Point

If, for some reason, error highlighting is not working, check if the current file is imported directly
in the project root or indirectly.

## Development guide

### Launch in dev mode in VS Code

* Run `npm install` in the root directory of the extension.
* Open VS Code.
* Switch to Debug viewlet.
* Run `Launch Client`.
* Open an APIB project or a standalone APIB file.
* Run `Attach to Server`.

You can launch client and server at once and select `Client + Server`, but then you need to open required APIB file
quickly, otherwise, the command `Attach to Server` will fail with an error.

### Debugging

To debug server part of the extension breakpoints and logging techniques are applicable.

For logging use `connection.console.log` function. Output results you can find in the `Extension Development Host`
window, in the `Output` section switch to `API Blueprint Language Server`.

### Public version bundling

Before publishing the extension, source files need to be bundled (there is one bundle for `client` and one bundle for `server`).
We use `esbuild` to manage bundling process.

To compile minified bundle (as the one that will be shipped with the published extension), run `npm run esbuild-min` command.
To compile human-readable bundle, run `npm run esbuild` command.

Besides that, you can check a list of actual files to be published. To print the list, run `npx @vscode/vsce ls`.
If you already have `@vscode/vsce` installed globally, you can use `vsce ls` and obtain the same result.

## Credits

Awesome logo for the project was made by [Igor Garybaldi](https://pandabanda.com/).

[![Sponsored by FunBox](https://funbox.ru/badges/sponsored_by_funbox_centered.png)](https://funbox.ru)
