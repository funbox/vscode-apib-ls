const {
  DiagnosticSeverity,
} = require('vscode-languageserver');

const crafter = require('@funbox/crafter');
const {
  get,
  belongsToCurrentFile,
  calculateCrafterParams,
} = require('./utils');

class DocumentValidator {
  constructor(serverState) {
    this.serverState = serverState;
  }

  async validate(textDocument) {
    const diagnostics = [];

    const { text, options, entryPath } = await calculateCrafterParams(textDocument, this.serverState);
    const refract = (await crafter.parse(text, options))[0].toRefract();

    refract.content.forEach(node => {
      if (isWarningOrError(node) && belongsToCurrentFile(node, options, entryPath, textDocument)) {
        const nodeType = node.meta.classes.content[0].content;
        const position = get('attributes', 'sourceMap', 'content', 0, 'content', 0, 'content').from(node);
        const start = position[0].content;
        const length = position[1].content;

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

    return diagnostics;
  }
}

function isWarningOrError(node) {
  if (node.element === 'annotation') {
    const nodeType = node.meta.classes.content[0].content;
    return nodeType === 'error' || nodeType === 'warning';
  }
  return false;
}

module.exports = DocumentValidator;
