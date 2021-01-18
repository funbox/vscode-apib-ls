const path = require('path');
const fs = require('fs');

function get(...p) {
  const from = (source) => p.reduce((xs, x) => ((xs && xs[x] !== undefined) ? xs[x] : null), source);

  return { from };
}

function belongsToCurrentFile(node, crafterOptions, entryPath, textDocument) {
  const textDocumentURI = DocumentURI.createFromURI(textDocument.uri);
  const file = get('attributes', 'sourceMap', 'content', 0, 'file').from(node);
  entryPath = path.normalize(entryPath);
  return (file ? path.join(crafterOptions.entryDir, file) : entryPath) === path.normalize(textDocumentURI.path);
}

async function calculateCrafterParams(textDocument, serverState) {
  const defaultCrafterParams = getDefaultCrafterParams(textDocument, serverState);
  const options = defaultCrafterParams.options;
  let text = defaultCrafterParams.text;
  let entryDocumentURI = DocumentURI.createFromURI(textDocument.uri);

  if (serverState.rootURI) {
    const rootURI = DocumentURI.createFromURI(serverState.rootURI);

    if (rootURI && entryDocumentURI.uri.indexOf(rootURI.uri) === 0) {
      const rootDocURI = await getRootDocURI(textDocument, serverState);
      const doc = serverState.documents.get(rootDocURI.uri);
      if (doc) {
        text = doc.getText();
        entryDocumentURI = rootDocURI;
      } else {
        try {
          text = await fs.promises.readFile(rootDocURI.path, { encoding: 'utf8' });
          entryDocumentURI = rootDocURI;
        // eslint-disable-next-line no-empty
        } catch (e) {}
      }
    }
  }

  options.entryDir = path.dirname(entryDocumentURI.path);

  return { text, options, entryPath: entryDocumentURI.path };
}

async function getRootDocURI(textDocument, serverState) {
  const settings = await getDocumentSettings(textDocument.uri, serverState);
  return DocumentURI.createFromURI(`${serverState.rootURI}/${settings.entryPoint}`);
}

function getDefaultCrafterParams(textDocument, serverState) {
  const options = { readFile: readFile.bind(null, serverState.documents) };
  const documentURI = DocumentURI.createFromURI(textDocument.uri);
  if (documentURI) {
    options.entryDir = path.dirname(documentURI.path);
  }

  const text = textDocument.getText();

  return { text, options };
}

function getDocumentSettings(resource, serverState) {
  if (!serverState.hasConfigurationCapability) {
    return Promise.resolve(serverState.globalSettings);
  }
  let result = serverState.documentSettings.get(resource);
  if (!result) {
    result = serverState.connection.workspace.getConfiguration({
      scopeUri: resource,
      section: 'apibLanguageServer',
    });
    serverState.documentSettings.set(resource, result);
  }
  return result;
}

function readFile(documents, file) {
  const documentURI = DocumentURI.createFromPath(file);
  const doc = documents.get(documentURI.uri);
  if (doc) {
    return doc.getText();
  }
  return fs.promises.readFile(file, { encoding: 'utf-8' });
}

function getRangeForNode(node, documentBuffer) {
  const sm = getSM(node);
  const start = sm[0].content;
  const length = sm[1].content;


  // TODO length - 1 баг или нет?
  return {
    start: positionAt(start, documentBuffer),
    end: positionAt(start + length - 1, documentBuffer),
  };
}

function positionAt(offset, buffer) {
  const text = buffer.slice(0, offset).toString();
  let line = 0;
  let character = 0;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      line++;
      character = 0;
    } else {
      character++;
    }
  }

  return { line, character };
}

function getSM(node) {
  return get('attributes', 'sourceMap', 'content', 0, 'content', 0, 'content').from(node);
}

class DocumentURI {
  constructor() {
    this.uri = null;
    this.path = null;
    this.protocol = null;
  }

  static createFromPath(documentPath) {
    let uri = `file://${documentPath}`;

    if (process.platform === 'win32') {
      uri = `file:///${documentPath.split(path.sep).map(encodeURIComponent).join(path.posix.sep)}`;
    }

    const result = new this();
    result.path = documentPath;
    result.uri = uri;

    return result;
  }

  static createFromURI(uri) {
    const url = new URL(uri);

    if (url.protocol !== 'file:') {
      return null;
    }

    const result = new this();
    result.uri = uri;
    result.path = decodeURIComponent(url.pathname);
    if (process.platform === 'win32' && result.path[0] === '/') {
      result.path = result.path.slice(1);
    }

    return result;
  }
}

module.exports = {
  get,
  belongsToCurrentFile,
  calculateCrafterParams,
  getRangeForNode,
  getSM,
  DocumentURI,
};
