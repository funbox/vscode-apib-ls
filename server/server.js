const {
  createConnection,
  DiagnosticSeverity,
  TextDocuments,
  ProposedFeatures,
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

let hasWorkspaceFolderCapability = false;

let rootURI;

connection.onInitialize((params) => {
  const capabilities = params.capabilities;
  rootURI = get('workspaceFolders', 0, 'uri').from(params);

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
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(() => {
      connection.console.log('Workspace folder change event received.');
    });
  }
});

// Cache the settings of all open documents
const documentSettings = new Map();

connection.onDidChangeConfiguration(() => {
  // Revalidate all open text documents
  documents.all().forEach(validateTextDocument);
});

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
  let rootDoc;
  let text;
  const options = {};
  const documentURI = new URL(textDocument.uri);
  const documentPath = documentURI.pathname;

  const diagnostics = [];

  if (rootURI) {
    const uri = new URL(rootURI);

    rootDoc = path.join(uri.pathname, 'doc.apib');
    if (uri.protocol === 'file:' && fs.existsSync(rootDoc)) {

      options.entryDir = uri.pathname;
      text = fs.readFileSync(rootDoc, {encoding: 'utf8'});
    }
  } else {
    text = textDocument.getText();
    if (documentURI.protocol === 'file:') {
      options.entryDir = path.dirname(documentPath);
    }
  }

  const refract = crafter.parseSync(text, options)[0].toRefract();

  refract.content.forEach(node => {
    if (node.element === 'annotation') {
      const nodeType = node.meta.classes.content[0].content;
      if (nodeType !== 'error' && nodeType !== 'warning') return;

      const position = get('attributes', 'sourceMap', 'content', 0, 'content', 0, 'content').from(node);
      const file = get('attributes', 'sourceMap', 'content', 0, 'file').from(node);

      if (!file && (!rootDoc || rootDoc === documentPath)
        || file && options.entryDir && path.join(options.entryDir, file) === documentPath
        ) {
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
    }
  });

  // Send the computed diagnostics to VSCode.
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
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
