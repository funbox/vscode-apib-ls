const {
  SymbolKind,
} = require('vscode-languageserver');
const crafter = require('@funbox/crafter');
const {
  get,
  belongsToCurrentFile,
  calculateCrafterParams,
} = require('./utils');

class SymbolsProcessor {
  constructor(serverState) {
    this.serverState = serverState;
  }

  async generateSymbols(symbolParam) {
    const textDocument = this.serverState.documents.get(symbolParam.textDocument.uri);
    const currentDocumentBuffer = Buffer.from(textDocument.getText());

    const { text, options, entryPath } = await calculateCrafterParams(textDocument, this.serverState);
    const refract = (await crafter.parse(text, options))[0].toRefract(true);

    const result = [];
    refract.content[0].content.forEach(node => {
      if (node.element === 'category' && get('meta', 'classes', 'content', 0, 'content').from(node) === 'dataStructures') {
        processDataStructures(node);
      }
    });

    return result;

    function processDataStructures(node) {
      if (!belongsToCurrentFile(node, options, entryPath, textDocument)) {
        return;
      }

      result.push({
        name: 'Data Structures',
        kind: SymbolKind.Namespace,
        location: {
          uri: null,
          range: getRangeForNode(node),
        },
      });

      node.content.forEach(namedType => processNamedType(namedType));
    }

    function processNamedType(node) {
      result.push({
        name: get('content', 'meta', 'id', 'content').from(node),
        kind: SymbolKind.Class,
        location: {
          uri: null,
          range: getRangeForNode(node),
        },
      });
    }

    function getRangeForNode(node) {
      const sm = get('attributes', 'sourceMap', 'content', 0, 'content', 0, 'content').from(node);
      const start = sm[0].content;
      const length = sm[1].content;

      // TODO length - 1 баг или нет?
      return {
        start: textDocument.positionAt(currentDocumentBuffer.slice(0, start).toString().length),
        end: textDocument.positionAt(currentDocumentBuffer.slice(0, start + length - 1).toString().length),
      };
    }
  }
}

module.exports = SymbolsProcessor;
