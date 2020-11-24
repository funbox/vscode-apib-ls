const {
  createConnection,
  DiagnosticSeverity,
  TextDocuments,
  ProposedFeatures,
  DidChangeConfigurationNotification,
  CompletionItemKind,
  TextDocumentSyncKind,
} = require('vscode-languageserver');

const {
  TextDocument,
} = require('vscode-languageserver-textdocument');

const path = require('path');
const crafter = require('@funbox/crafter');
const fs = require('fs');

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

let rootURI;

connection.onInitialize((params) => {
  const capabilities = params.capabilities;
  rootURI = get('workspaceFolders', 0, 'uri').from(params);

  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  const result = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion.
      completionProvider: {
        resolveProvider: true,
      },
    },
  };
  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    };
  }
  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(() => {
      connection.console.log('Workspace folder change event received.');
    });
  }
});

const defaultSettings = { entryPoint: 'doc.apib' };
let globalSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings = new Map();

connection.onDidChangeConfiguration(() => {
  if (hasConfigurationCapability) {
    // Reset all cached document settings
    documentSettings.clear();
  } else {
    globalSettings = change.settings.languageServerExample || defaultSettings;
  }

  // Revalidate all open text documents
  documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource) {
  if (!hasConfigurationCapability) {
    return Promise.resolve(globalSettings);
  }
  let result = documentSettings.get(resource);
  if (!result) {
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: 'apibLanguageServer'
    });
    documentSettings.set(resource, result);
  }
  return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
  documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
  validateTextDocument(change.document);
});

async function validateTextDocument(textDocument) {
  const textDocumentPath = (new URL(textDocument.uri)).pathname;
  const diagnostics = [];

  const { text, options, entryPath } = await calculateCrafterParams(textDocument);
  const refract = (await crafter.parse(text, options))[0].toRefract();

  refract.content.forEach(node => {
    if (isWarningOrError(node) && belongsToCurrentFile(node)) {
      const nodeType = node.meta.classes.content[0].content;
      const position = get('attributes', 'sourceMap', 'content', 0, 'content', 0, 'content').from(node);
      let start = position[0].content;
      let length = position[1].content;

      diagnostics.push({
        severity: nodeType === 'error' ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
        range: {
          start: textDocument.positionAt(start),
          end: textDocument.positionAt(start + length),
        },
        message: node.content,
        source: 'API Blueprint',
      });
    }
  });

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });

  function belongsToCurrentFile(node) {
    const file = get('attributes', 'sourceMap', 'content', 0, 'file').from(node);
    return (file ? path.join(options.entryDir, file) : entryPath) === textDocumentPath;
  }
}

async function calculateCrafterParams(textDocument) {
  const defaultCrafterParams = getDefaultCrafterParams(textDocument);
  const options = defaultCrafterParams.options;
  let text = defaultCrafterParams.text;
  let entryPath = (new URL(textDocument.uri)).pathname;

  if (rootURI) {
    const uri = new URL(rootURI);

    if (uri.protocol === 'file:') {
      const p = await rootDocPath(textDocument);
      const doc = documents.get(`file://${p}`);
      if (doc) {
        text = doc.getText();
        entryPath = (new URL(doc.uri)).pathname;
      } else {
        try {
          text = await fs.promises.readFile(p, {encoding: 'utf8'});
          entryPath = p;
        } catch (e) {
        }
      }
    }
  }

  return { text, options, entryPath };
}

async function rootDocPath(textDocument) {
  const settings = await getDocumentSettings(textDocument.uri);
  if (!rootURI) return null;
  const uri = new URL(rootURI);
  return path.join(uri.pathname, settings.entryPoint);
}

function getDefaultCrafterParams(textDocument) {
  const options = { readFile };
  const documentURI = new URL(textDocument.uri);
  if (documentURI.protocol === 'file:') {
    options.entryDir = path.dirname(documentURI.pathname);
  }

  let text = textDocument.getText();

  return { text, options };
}

function isWarningOrError(node) {
  if (node.element === 'annotation') {
    const nodeType = node.meta.classes.content[0].content;
    return nodeType === 'error' || nodeType === 'warning';
  }
  return false;
}

connection.onDidChangeWatchedFiles(() => {
  // Monitored files have change in VSCode
  connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(() => [
  {
    label: 'TypeScript',
    kind: CompletionItemKind.Text,
    data: 1,
  },
  {
    label: 'JavaScript',
    kind: CompletionItemKind.Text,
    data: 2,
  },
]);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item) => {
  if (item.data === 1) {
    item.detail = 'TypeScript details';
    item.documentation = 'TypeScript documentation';
  } else if (item.data === 2) {
    item.detail = 'JavaScript details';
    item.documentation = 'JavaScript documentation';
  }
  return item;
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

function get(...path) {
  const from = (source) => path.reduce((xs, x) => ((xs && xs[x] !== undefined) ? xs[x] : null), source);

  return { from };
}

async function readFile(file) {
  const doc = documents.get(`file://${file}`);
  if (doc) {
    return doc.getText();
  }
  return fs.promises.readFile(file, { encoding: 'utf-8' });
}
