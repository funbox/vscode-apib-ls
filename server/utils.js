const path = require('path');
const fs = require('fs');

function get(...p) {
  const from = (source) => p.reduce((xs, x) => ((xs && xs[x] !== undefined) ? xs[x] : null), source);

  return { from };
}

function belongsToCurrentFile(node, crafterOptions, entryPath, textDocument) {
  const textDocumentPath = (new URL(textDocument.uri)).pathname;
  const file = get('attributes', 'sourceMap', 'content', 0, 'file').from(node);
  return (file ? path.join(crafterOptions.entryDir, file) : entryPath) === textDocumentPath;
}

async function calculateCrafterParams(textDocument, serverState) {
  const defaultCrafterParams = getDefaultCrafterParams(textDocument, serverState);
  const options = defaultCrafterParams.options;
  let text = defaultCrafterParams.text;
  let entryPath = (new URL(textDocument.uri)).pathname;

  if (serverState.rootURI) {
    const uri = new URL(serverState.rootURI);

    if (uri.protocol === 'file:' && entryPath.indexOf(uri.pathname) === 0) {
      const p = await rootDocPath(textDocument, serverState);
      const doc = serverState.documents.get(`file://${p}`);
      if (doc) {
        text = doc.getText();
        entryPath = (new URL(doc.uri)).pathname;
      } else {
        try {
          text = await fs.promises.readFile(p, { encoding: 'utf8' });
          entryPath = p;
        // eslint-disable-next-line no-empty
        } catch (e) {}
      }
    }
  }

  options.entryDir = path.dirname(entryPath);

  return { text, options, entryPath };
}

async function rootDocPath(textDocument, serverState) {
  const settings = await getDocumentSettings(textDocument.uri, serverState);
  const uri = new URL(serverState.rootURI);
  return path.join(uri.pathname, settings.entryPoint);
}

function getDefaultCrafterParams(textDocument, serverState) {
  const options = { readFile: readFile.bind(null, serverState.documents) };
  const documentURI = new URL(textDocument.uri);
  if (documentURI.protocol === 'file:') {
    options.entryDir = path.dirname(documentURI.pathname);
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
  const doc = documents.get(`file://${file}`);
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

module.exports = {
  get,
  belongsToCurrentFile,
  calculateCrafterParams,
  getRangeForNode,
  getSM,
};
