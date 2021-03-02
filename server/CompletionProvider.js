const crafter = require('@funbox/crafter');
const { CompletionItemKind } = require('vscode-languageserver');
const {
  get,
  calculateCrafterParams,
  DocumentURI,
  extractSymbols,
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
    const symbols = await extractSymbols(refract.content[0], options.entryDir, entryPath, this.serverState);
    this.namedTypes = Array.from(symbols.namedTypes.keys());

    return this.getCompletionsFromRefract(pos, refract.content[0], line);
  }

  getCompletionsFromRefract(pos, rootNode, line) {
    let result = [];

    if (positionBelongsToNode(pos, rootNode)) {
      const nodeForPosition = rootNode.content.find(node => positionBelongsToNode(pos, node));

      if (nodeForPosition) {
        if (nodeForPosition.element === 'category') {
          const categoryClass = get('meta', 'classes', 'content', 0, 'content').from(nodeForPosition);
          if (categoryClass === 'resourceGroup') {
            result = result.concat(this.getCompletionsFromResourceGroup(pos, nodeForPosition, line));
          }

          if (categoryClass === 'dataStructures') {
            result = result.concat(this.getCompletionsFromDataStructures(pos, nodeForPosition, line));
          }

          if (categoryClass === 'resourcePrototypes') {
            result = result.concat(this.getCompletionsFromResourcePrototypes(pos, nodeForPosition, line));
          }
        }

        if (nodeForPosition.element === 'resource') {
          result = result.concat(this.getCompletionsFromResource(pos, nodeForPosition, line));
        }
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

  getCompletionsFromResourcePrototypes(pos, node, line) {
    const nodeForPosition = node.content.find(n => positionBelongsToNode(pos, n));

    if (nodeForPosition) {
      return this.getCompletionsFromResourcePrototype(pos, nodeForPosition, line);
    }

    return [];
  }

  getCompletionsFromResourcePrototype(pos, node, line) {
    const sectionNames = [
      'Response',
    ];

    let result = [];

    const nodeForPosition = node.content.find(n => n.element === 'httpResponse' && positionBelongsToNode(pos, n));

    if (nodeForPosition) {
      result = result.concat(this.getCompletionsFromRequestOrResponse(pos, nodeForPosition, line));
    }

    if (line[0] === '+') {
      const lineForCompletion = line.replace(/^\+\s*/, '').toLocaleLowerCase();

      result = result.concat(sectionNames.filter(i => i.toLocaleLowerCase().indexOf(lineForCompletion) === 0).map(toItem));
    }

    return result;
  }

  getCompletionsFromDataStructures(pos, node, line) {
    const nodeForPosition = node.content.find(n => positionBelongsToNode(pos, n));

    if (nodeForPosition) {
      return this.getCompletionsFromDataStructure(pos, nodeForPosition, line);
    }

    return [];
  }

  getCompletionsFromResource(pos, node, line) {
    const sectionNames = [
      'Parameters',
    ];

    let result = [];

    const nodeForPosition = node.content.find(n => positionBelongsToNode(pos, n));

    if (nodeForPosition && nodeForPosition.element === 'transition') {
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

    const nodeForPosition = node.content.find(n => positionBelongsToNode(pos, n));

    if (nodeForPosition && nodeForPosition.element === 'dataStructure') {
      result = result.concat(this.getCompletionsFromDataStructure(pos, nodeForPosition, line));
    }

    if (/\s+\+/.exec(line)) {
      const lineForCompletion = line.replace(/^\s+\+\s*/, '').toLocaleLowerCase();

      result = result.concat(sectionNames.filter(i => i.toLocaleLowerCase().indexOf(lineForCompletion) === 0).map(toItem));
    }

    return result;
  }

  getCompletionsFromDataStructure(pos, node, line) {
    if (node.meta && node.meta.description && positionBelongsToNode(pos, node.meta.description)) return [];

    if (node.content) {
      if (Array.isArray(node.content)) {
        const nodeForPosition = node.content.find(n => positionBelongsToNode(pos, n));

        if (nodeForPosition) {
          return this.getCompletionsFromDataStructure(pos, nodeForPosition, line);
        }
      } else if (positionBelongsToNode(pos, node.content)) {
        return this.getCompletionsFromDataStructure(pos, node.content, line);
      }
    }


    const typeAttributes = [
      'required',
      'fixed',
      'fixed-type',
      'optional',
      'nullable',
      'pattern',
      'format',
      'min-length',
      'max-length',
      'minimum',
      'maximum',
    ];

    const defaultTypes = [
      'string',
      'number',
      'boolean',
      'file',
      'object',
      'array',
      'enum',
    ];

    const preparedLine = line.replace(/^\+\s*/, '');
    const [lineForCompletion, inSubType] = getLineForCompletion(preparedLine);

    let result = [];

    if (lineForCompletion) {
      if (!inSubType) {
        result = result.concat(typeAttributes.filter(i => i.toLocaleLowerCase().indexOf(lineForCompletion) === 0).map(toItem));
      }
      result = result.concat(defaultTypes.filter(i => i.toLocaleLowerCase().indexOf(lineForCompletion) === 0).map(toItem));
      result = result.concat(this.namedTypes.filter(i => i.toLocaleLowerCase().indexOf(lineForCompletion) === 0).map(toItem));
    }

    return result;

    function getLineForCompletion(signature) {
      let i = 0;

      // skip name
      while (i < signature.length) {
        if (signature[i] === '`') {
          const escapedResult = retrieveEscaped(signature, i);
          if (escapedResult.result) {
            signature = escapedResult.str;
            i = 0;
          } else {
            i++;
          }
        } else if (
          signature[i] === ':'
          || signature[i] === '('
          || signature[i] === '-'
        ) {
          break;
        } else {
          i++;
        }
      }

      if (i === signature.length || signature[i] === '-') return [null, false];

      // skip description
      if (signature[i] === ':') {
        i++;
        while (i < signature.length) {
          if (signature[i] === '`') {
            const escapedResult = retrieveEscaped(signature, i);
            if (escapedResult.result) {
              signature = escapedResult.str;
              i = 0;
            } else if (escapedResult.escaped) {
              signature = escapedResult.str;
              i = 0;
            } else {
              i++;
            }
          } else if (
            signature[i] === '('
            || signature[i] === '-'
          ) {
            break;
          } else {
            i++;
          }
        }
      }

      if (i === signature.length || signature[i] === '-') return [null, false];

      // in attributes
      let strForCompletion = '';
      i++;

      let attributeValueContext = false;
      let subTypeContext = false;
      let slashesNumber = 0;

      while (i < signature.length) {
        if (signature[i] === ')' && !attributeValueContext) return [null, false];

        if (signature[i] === '[' && !attributeValueContext) {
          subTypeContext = true;
          strForCompletion = '';
        } else if (signature[i] === ']' && !attributeValueContext) {
          subTypeContext = false;
        } else if (signature[i] === ',' && !attributeValueContext) {
          strForCompletion = '';
        } else {
          strForCompletion += signature[i];
        }

        if (signature[i] === '"' && slashesNumber % 2 === 0) {
          attributeValueContext = !attributeValueContext;
        }

        if (signature[i] === '\\') {
          slashesNumber++;
        } else {
          slashesNumber = 0;
        }

        i++;
      }

      return [strForCompletion.trim().toLocaleLowerCase(), subTypeContext];
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

function retrieveEscaped(str, startPos) {
  let levels = 0;
  const escapeChar = str[startPos];

  while (str[startPos + levels] === escapeChar) {
    levels++;
  }

  const borderChars = str.substr(startPos, levels);
  const endPos = str.substr(startPos + levels).indexOf(borderChars);

  if (endPos === -1) {
    return {
      str: str.substr(levels),
      result: '',
      escaped: borderChars,
    };
  }

  const result = str.substr(startPos, startPos + endPos + levels * 2);

  return {
    str: str.substr(startPos + result.length),
    result,
    escaped: str.substr(startPos, (levels - 1) * 2 + result.length),
  };
}

module.exports = CompletionProvider;
