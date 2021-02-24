const crafter = require('@funbox/crafter');
const { CompletionItemKind } = require('vscode-languageserver');
const {
  get,
  calculateCrafterParams,
  DocumentURI,
} = require('./utils');

class CompletionProvider {
  constructor(serverState) {
    this.serverState = serverState;
  }

  async getCompletions(positionParam) {
    const textDocument = this.serverState.documents.get(positionParam.textDocument.uri);
    const offset = getPosInBytes(textDocument.getText(), positionParam.position);
    const line = textDocument.getText().split('\n')[positionParam.position.line].slice(0, positionParam.position.character);

    const { text, options, entryPath } = await calculateCrafterParams(textDocument, this.serverState);

    let file;

    const textDocumentURI = DocumentURI.createFromURI(positionParam.textDocument.uri);
    if (textDocumentURI.path !== entryPath) {
      file = textDocumentURI.path;

      let entryDir = options.entryDir;
      if (entryDir[entryDir.length - 1] !== '/') entryDir = `${entryDir}/`;
      if (file.indexOf(entryDir) === 0) {
        file = file.replace(entryDir, '');
      }
    }

    const pos = { offset, file };

    options.languageServerMode = true;
    const refract = (await crafter.parse(text, options))[0].toRefract(true);

    return this.getCompletionsFromRefract(pos, refract.content[0], line);
  }

  getCompletionsFromRefract(pos, rootNode, line) {
    let result = [];

    if (positionBelongsToNode(pos, rootNode)) {
      const nodeForPosition = rootNode.content.find(node => positionBelongsToNode(pos, node));

      if (nodeForPosition && nodeForPosition.element === 'resource') {
        result = result.concat(this.getCompletionsFromResource(pos, nodeForPosition, line));
      }
    }

    result = result.concat(getSectionNamesComplitions());
    result = result.concat(getRequestMethodsComplitions());

    return result;

    function getSectionNamesComplitions() {
      const sectionNames = [
        'Data Structures',
        'Schema Structures',
        'Resource Prototypes',
        'Group',
        'Import',
      ];

      if (line[0] !== '#') return [];

      const lineForCompletion = line.replace(/^#+\s*/, '').toLocaleLowerCase();

      return sectionNames.filter(i => i.toLocaleLowerCase().indexOf(lineForCompletion) === 0).map(toItem);
    }

    function getRequestMethodsComplitions() {
      const requestMethods = [
        'GET',
        'POST',
        'PUT',
        'DELETE',
        'OPTIONS',
        'PATCH',
        'PROPPATCH',
        'LOCK',
        'UNLOCK',
        'COPY',
        'MOVE',
        'MKCOL',
        'HEAD',
        'LINK',
        'UNLINK',
        'CONNECT',
      ];

      if (line[0] !== '#') return [];

      // Two complition options are possible:
      // # GET /foo
      // # Users [GET /foo]

      const lineForCompletion = line.replace(/^#+\s*/, '').replace(/^[^[]+\[/, '').toLocaleLowerCase();
      return requestMethods.filter(i => i.toLocaleLowerCase().indexOf(lineForCompletion) === 0).map(toItem);
    }
  }

  getCompletionsFromResource(pos, node, line) {
    const sectionNames = [
      'Parameters',
    ];

    let result = [];

    const nodeForPosition = node.content.find(n => positionBelongsToNode(pos, n));

    if (nodeForPosition.element === 'transition') {
      result = result.concat(this.getCompletionsFromTransition(pos, nodeForPosition, line));
    }

    if (line[0] === '+') {
      const lineForCompletion = line.replace(/^\+\s*/, '').toLocaleLowerCase();
      result = result.concat(sectionNames.filter(i => i.toLocaleLowerCase().indexOf(lineForCompletion) === 0).map(toItem));
    }

    return result;
  }

  getCompletionsFromTransition(pos, node, line) {
    const sectionNames = [
      'Request',
      'Response',
    ];

    let result = [];

    // + Request does not generate httpTransaction, so auto completion wouldn't work without + Response
    // httpTransaction has no sourceMap, so we need to check its content
    const transactionNode = node.content.find(n => n.element === 'httpTransaction' && (positionBelongsToNode(pos, n.content[0]) || positionBelongsToNode(pos, n.content[1])));

    if (transactionNode) {
      const nodeForPosition = transactionNode.content.find(n => positionBelongsToNode(pos, n));

      result = result.concat(this.getCompletionsFromRequestOrResponse(pos, nodeForPosition, line));
    }

    if (line[0] === '+') {
      const lineForCompletion = line.replace(/^\+\s*/, '').toLocaleLowerCase();

      result = result.concat(sectionNames.filter(i => i.toLocaleLowerCase().indexOf(lineForCompletion) === 0).map(toItem));
    }

    return result;
  }

  getCompletionsFromRequestOrResponse(pos, node, line) {
    const sectionNames = [
      'Attributes',
      'Body',
      'Schema',
    ];

    let result = [];

    if (/\s+\+/.exec(line)) {
      const lineForCompletion = line.replace(/^\s+\+\s*/, '').toLocaleLowerCase();

      result = result.concat(sectionNames.filter(i => i.toLocaleLowerCase().indexOf(lineForCompletion) === 0).map(toItem));
    }

    return result;
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
  return sm && !!sm.find(({ file, content: blockContent }) => {
    if (file !== pos.file) return false;

    return blockContent.some(({ content: itemContent }) => {
      const start = itemContent[0].content;
      const length = itemContent[1].content;
      return start <= pos.offset && start + length >= pos.offset;
    });
  });
}

function toItem(str) {
  return { label: str, kind: CompletionItemKind.Keyword };
}

module.exports = CompletionProvider;
