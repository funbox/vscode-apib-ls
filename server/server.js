const {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  DidChangeConfigurationNotification,
  TextDocumentSyncKind,
} = require('vscode-languageserver');

const {
  TextDocument,
} = require('vscode-languageserver-textdocument');

const {
  get,
} = require('./utils');

const SymbolsProcessor = require('./SymbolsProcessor');
const DocumentValidator = require('./DocumentValidator');

const defaultSettings = { entryPoint: 'doc.apib' };

const serverState = {
  // Create a simple text document manager.
  documents: new TextDocuments(TextDocument),
  hasConfigurationCapability: false,
  hasWorkspaceFolderCapability: false,
  rootURI: null,
  globalSettings: defaultSettings, // TODO clone?
  // Cache the settings of all open documents
  documentSettings: new Map(),
};

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

const symbolsProcessor = new SymbolsProcessor(serverState);
const documentValidator = new DocumentValidator(serverState);

connection.onInitialize((params) => {
  const capabilities = params.capabilities;
  serverState.rootURI = get('workspaceFolders', 0, 'uri').from(params);

  serverState.hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  serverState.hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  const result = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      documentSymbolProvider: true,
    },
  };
  if (serverState.hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    };
  }
  return result;
});

connection.onInitialized(() => {
  if (serverState.hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
  if (serverState.hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(() => {
      connection.console.log('Workspace folder change event received.');
    });
  }
});

connection.onDidChangeConfiguration(change => {
  if (serverState.hasConfigurationCapability) {
    // Reset all cached document settings
    serverState.documentSettings.clear();
  } else {
    serverState.globalSettings = change.settings.apibLanguageServer || defaultSettings;
  }

  // Revalidate all open text documents
  serverState.documents.all().forEach(doc => {
    documentValidator.validate(doc).then(diagnostics => {
      connection.sendDiagnostics({ uri: doc.uri, diagnostics });
    });
  });
});

// Only keep settings for open documents
serverState.documents.onDidClose(e => {
  serverState.documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
serverState.documents.onDidChangeContent(change => {
  documentValidator.validate(change.document).then(diagnostics => {
    connection.sendDiagnostics({ uri: change.document.uri, diagnostics });
  });
});

connection.onDocumentSymbol(symbolParam => symbolsProcessor.generateSymbols(symbolParam));

connection.onDidChangeWatchedFiles(() => {
  // Monitored files have change in VSCode
  connection.console.log('We received an file change event');
});

// Make the text document manager listen on the connection
// for open, change and close text document events
serverState.documents.listen(connection);

// Listen on the connection
connection.listen();
