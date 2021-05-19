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
  const options = { readFile: readFile.bind(null, serverState.documents) };
  const documentURI = DocumentURI.createFromURI(textDocument.uri);
  if (documentURI) {
    options.entryDir = path.dirname(documentURI.path);
  } else if (serverState.rootURI) {
    const rootURI = DocumentURI.createFromURI(serverState.rootURI);
    options.entryDir = path.dirname(rootURI.path);
  }

  const text = textDocument.getText();
  const entryPath = documentURI.path;

  return { text, options, entryPath };
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

async function extractSymbols(rootNode, entryDir, entryPath, serverState) {
  const namedTypes = new Map();
  const resourcePrototypes = new Map();

  const buffers = new Map();

  const extractSymbol = async (typeNode, typeContentNode, symbols) => {
    const fileName = get('attributes', 'sourceMap', 'content', 0, 'file').from(typeNode);
    const filePath = fileName ? path.join(entryDir, fileName) : entryPath;
    const uri = DocumentURI.createFromPath(filePath).uri;
    let buffer;
    let textDocument;

    if (buffers.has(uri)) {
      buffer = buffers.get(uri);
    } else if (serverState.documents.get(uri)) {
      textDocument = serverState.documents.get(uri);
      buffer = Buffer.from(textDocument.getText());
      buffers.set(uri, buffer);
    } else {
      buffer = await fs.promises.readFile(filePath);
      buffers.set(uri, buffer);
    }

    const name = get('meta', 'id', 'content').from(typeContentNode);
    const location = {
      uri,
      range: getRangeForNode(typeNode, buffer),
    };
    symbols.set(name, location);
  };

  await iterateNodeContents(rootNode, async (node) => {
    if (node.element === 'category') {
      const categoryClass = get('meta', 'classes', 'content', 0, 'content').from(node);
      if (categoryClass === 'dataStructures') {
        await iterateNodeContents(node, namedType => extractSymbol(
          namedType,
          namedType.content,
          namedTypes,
        ));
      }

      if (categoryClass === 'schemaStructures') {
        await iterateNodeContents(node, schemaType => extractSymbol(
          schemaType,
          schemaType,
          namedTypes,
        ));
      }

      if (categoryClass === 'resourcePrototypes') {
        await iterateNodeContents(node, resourcePrototype => extractSymbol(
          resourcePrototype,
          resourcePrototype,
          resourcePrototypes,
        ));
      }
    }
  });

  return { namedTypes, resourcePrototypes };

  async function iterateNodeContents(node, it) {
    for (let j = 0; j < node.content.length; j++) {
      await it(node.content[j]);
    }
  }
}

function getPosInBytes(text, pos) {
  const origLines = text.split('\n');
  const resLines = origLines.slice(0, pos.line);
  resLines.push(origLines[pos.line].slice(0, pos.character));
  return Buffer.from(resLines.join('\n')).length;
}

function positionBelongsToNode(pos, node) {
  const sm = get('attributes', 'sourceMap', 'content').from(node);
  return sm && sm.some(({ file, content: blockContent }) => {
    if (file !== pos.file) return false;

    return blockContent.some(({ content: itemContent }) => {
      const start = itemContent[0].content;
      const length = itemContent[1].content;
      return start <= pos.offset && start + length >= pos.offset;
    });
  });
}

function isAnnotationOfType(node, type) {
  if (node.element !== 'annotation') return false;

  const nodeType = node.meta.classes.content[0].content;
  return nodeType === type;
}

function isWarningOrError(node) {
  return isAnnotationOfType(node, 'warning') || isAnnotationOfType(node, 'error');
}

module.exports = {
  get,
  belongsToCurrentFile,
  calculateCrafterParams,
  getRangeForNode,
  getSM,
  DocumentURI,
  extractSymbols,
  getPosInBytes,
  positionBelongsToNode,
  isAnnotationOfType,
  isWarningOrError,
};
