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

    return this.getCompletionsFromRefract(pos, refract.content[0]);
  }

  getCompletionsFromRefract(pos, rootNode) {
    if (!positionBelongsToNode(pos, rootNode)) return undefined;

    const nodeForPosition = rootNode.content.find(node => positionBelongsToNode(pos, node));

    const sectionNames = [
      'Data Structures',
      'Schema Structures',
      'Resource Prototypes',
      'Group',
    ];

    const toItem = str => ({ label: str, kind: CompletionItemKind.Keyword });

    if (!nodeForPosition) {
      return sectionNames.map(toItem);
    }

    if (nodeForPosition.element === 'copy') {
      const sm = get('attributes', 'sourceMap', 'content').from(nodeForPosition);
      const itemOffset = pos.offset - sm[0].content[0].content[0].content;
      const lines = Buffer.from(nodeForPosition.content).slice(0, itemOffset).toString().split('\n');
      const targetStr = lines[lines.length - 1].replace(/^#+\s*/, '').toLocaleLowerCase();

      return sectionNames
        .filter(sn => sn.toLocaleLowerCase().indexOf(targetStr) === 0)
        .map(toItem);
    }

    return [];
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

module.exports = CompletionProvider;
