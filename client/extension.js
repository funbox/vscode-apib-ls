const path = require('path');
const { workspace } = require('vscode'); // eslint-disable-line import/no-unresolved

const {
  LanguageClient,
  TransportKind,
} = require('vscode-languageclient');

let client;
const baseDir = process.env.BASE_DIR || '';

function activate(context) {
  const serverModule = context.asAbsolutePath(path.join(baseDir, 'server', 'server.js'));
  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

  const serverOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  // Options to control the language client
  const clientOptions = {
    documentSelector: [{ scheme: 'file', language: 'apib' }],
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: workspace.createFileSystemWatcher('**/.clientrc'),
    },
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    'apibLanguageServer',
    'API Blueprint Language Server',
    serverOptions,
    clientOptions,
  );

  // Start the client. This will also launch the server
  client.start();
}

function deactivate() {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

module.exports = {
  activate,
  deactivate,
};
