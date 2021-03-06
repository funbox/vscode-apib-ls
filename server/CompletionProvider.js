const path = require('path');
const fs = require('fs');
const crafter = require('@funboxteam/crafter');
const { CompletionItemKind } = require('vscode-languageserver');
const {
  get,
  calculateCrafterParams,
  DocumentURI,
  extractSymbols,
  getPosInBytes,
  positionBelongsToNode,
} = require('./utils');

const HEADER_RE = /^\s*#+\s*/;
const SECTION_TYPE_RE = /^\s*#+\s*/;
const LIST_ITEM_RE = /^\s*[+-]\s*/;
const ROOT_LIST_ITEM_RE = /^[+-]\s*/;
const INNER_LIST_ITEM_RE = /^\s+[+-]\s*/;
const ACTION_TITLE_RE = /^[^[]+\[/;
const IMPORT_SECTION_RE = /^\s*#\s*[Ii]mport\s+/;

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
  'default',
  'sample',
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

const typeSections = [
  'Default',
  'Sample',
  'Items',
  'Members',
  'Properties',
];

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
      if (file.startsWith(entryDir)) {
        file = file.replace(entryDir, '');
      }
    }

    const pos = { offset, file };

    options.languageServerMode = true;
    const refract = (await crafter.parse(text, options))[0].toRefract(true);
    const symbols = await extractSymbols(refract.content[0], options.entryDir, entryPath, this.serverState);
    this.namedTypes = Array.from(symbols.namedTypes.keys());
    this.resourcePrototypes = Array.from(symbols.resourcePrototypes.keys());

    const completions = await this.getCompletionsFromRefract(pos, refract.content[0], line, options.entryDir);

    return completions;
  }

  async getCompletionsFromRefract(pos, rootNode, line, entryDir) {
    let result = [];

    if (positionBelongsToNode(pos, rootNode)) {
      const nodeForPosition = rootNode.content.find(node => positionBelongsToNode(pos, node));

      if (nodeForPosition) {
        switch (nodeForPosition.element) {
          case 'category': {
            const categoryClass = get('meta', 'classes', 'content', 0, 'content').from(nodeForPosition);
            switch (categoryClass) {
              case 'resourceGroup':
                result = result.concat(this.getCompletionsFromResourceGroup(pos, nodeForPosition, line));
                break;
              case 'dataStructures':
                result = result.concat(this.getCompletionsFromDataStructures(pos, nodeForPosition, line));
                break;
              case 'resourcePrototypes':
                result = result.concat(this.getCompletionsFromResourcePrototypes(pos, nodeForPosition, line));
                break;
              // no default
            }
            break;
          }
          case 'resource':
            result = result.concat(this.getCompletionsFromResource(pos, nodeForPosition, line));
            break;
          // no default
        }
      }
    }

    result = result.concat(getSectionNamesCompletions());
    result = result.concat(getRequestMethodsCompletions());

    if (IMPORT_SECTION_RE.exec(line)) {
      const importSectionCompletions = await getImportSectionCompletions();
      result = result.concat(importSectionCompletions);
    }

    return result;

    function getSectionNamesCompletions() {
      const sectionNames = [
        'Data Structures',
        'Schema Structures',
        'Resource Prototypes',
        'Group',
        'Import',
      ];

      if (!HEADER_RE.exec(line)) return [];

      const lineToComplete = line.replace(HEADER_RE, '').toLocaleLowerCase();

      return getCompletionOptions(sectionNames, lineToComplete);
    }

    function getRequestMethodsCompletions() {
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

      // Two completion options are possible:
      // # GET /foo
      // # Users [GET /foo]

      const lineToComplete = line.replace(HEADER_RE, '').replace(ACTION_TITLE_RE, '').toLocaleLowerCase();
      return getCompletionOptions(requestMethods, lineToComplete);
    }

    async function getImportSectionCompletions() {
      const importLine = line.replace(IMPORT_SECTION_RE, '').toLocaleLowerCase();

      const fileDir = pos.file && !path.isAbsolute(importLine) ? getPath(pos.file) : '';
      const importPath = getPath(importLine);

      const fileNames = await fs.promises.readdir(path.join(entryDir, fileDir, importPath));

      return getCompletionOptions(fileNames, importLine.split('/').pop());

      function getPath(str) {
        return str.split('/').slice(0, -1).join('/');
      }
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

    if (ROOT_LIST_ITEM_RE.test(line)) {
      const lineToComplete = line.replace(ROOT_LIST_ITEM_RE, '').toLocaleLowerCase();

      result = result.concat(getCompletionOptions(sectionNames, lineToComplete));
    }

    return result;
  }

  getCompletionsFromDataStructures(pos, node, line) {
    const nodeForPositionIndex = node.content.findIndex(n => positionBelongsToNode(pos, n));
    const nodeForPosition = node.content[nodeForPositionIndex];

    if (nodeForPosition) {
      return this.getCompletionsFromDataStructure(pos, nodeForPosition, line, nodeForPositionIndex);
    }

    return [];
  }

  getCompletionsFromResourceGroup(pos, node, line) {
    const nodeForPosition = node.content.find(n => positionBelongsToNode(pos, n));

    if (nodeForPosition && nodeForPosition.element === 'resource') {
      return this.getCompletionsFromResource(pos, nodeForPosition, line);
    }

    return this.getCompletionsFromAttributesPrototypes(pos, node);
  }

  getCompletionsFromResource(pos, node, line) {
    const sectionNames = [
      'Parameters',
    ];

    let result = [];

    const nodeForPosition = node.content.find(n => positionBelongsToNode(pos, n));

    if (nodeForPosition && nodeForPosition.element === 'transition') {
      result = result.concat(this.getCompletionsFromTransition(pos, nodeForPosition, line));
    } else if (positionBelongsToNode(pos, node) && node.element === 'resource') {
      result = result.concat(this.getCompletionsFromTransition(pos, node, line));
    }

    if (ROOT_LIST_ITEM_RE.test(line)) {
      const lineToComplete = line.replace(ROOT_LIST_ITEM_RE, '').toLocaleLowerCase();
      result = result.concat(getCompletionOptions(sectionNames, lineToComplete));
    }

    return result;
  }

  getCompletionsFromTransition(pos, node, line) {
    const prototypes = this.getCompletionsFromAttributesPrototypes(pos, node);

    if (prototypes.length) {
      return prototypes;
    }

    const sectionNames = [
      'Request',
      'Response',
    ];

    let result = [];

    const transactionNode = node.content.find(n => n.element === 'httpTransaction' && positionBelongsToNode(pos, n));

    if (transactionNode) {
      const nodeForPosition = transactionNode.content.find(n => positionBelongsToNode(pos, n));

      result = result.concat(this.getCompletionsFromRequestOrResponse(pos, nodeForPosition, line));
    }

    if (ROOT_LIST_ITEM_RE.test(line)) {
      const lineToComplete = line.replace(ROOT_LIST_ITEM_RE, '').toLocaleLowerCase();

      result = result.concat(getCompletionOptions(sectionNames, lineToComplete));
    }

    return result;
  }

  getCompletionsFromAttributesPrototypes(pos, node) {
    const prototypes = get('attributes', 'prototypes', 'content').from(node);

    if (prototypes && prototypes.length) {
      const attribute = prototypes.find(attr => positionBelongsToNode(pos, attr));

      if (attribute) {
        return getCompletionOptions(this.resourcePrototypes, attribute.content.toLocaleLowerCase());
      }
    }

    return [];
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

    if (INNER_LIST_ITEM_RE.exec(line)) {
      const lineToComplete = line.replace(INNER_LIST_ITEM_RE, '').toLocaleLowerCase();

      result = result.concat(getCompletionOptions(sectionNames, lineToComplete));
    }

    return result;
  }

  getCompletionsFromDataStructure(pos, node, line, nodeIndex) {
    if (node.meta && node.meta.description && positionBelongsToNode(pos, node.meta.description)) return [];

    if (node.content) {
      if (Array.isArray(node.content)) {
        const nodeForPosition = node.content.find(n => positionBelongsToNode(pos, n));

        if (nodeForPosition) {
          return this.getCompletionsFromDataStructure(pos, nodeForPosition, line);
        }
      } else if (positionBelongsToNode(pos, node.content)) {
        return this.getCompletionsFromDataStructure(pos, node.content, line);
      } else if (node.element === 'member' && positionBelongsToNode(pos, node.content.value)) {
        return this.getCompletionsFromDataStructure(pos, node.content.value, line);
      }
    }

    const preparedLine = line
      .replace(LIST_ITEM_RE, '')
      .replace(SECTION_TYPE_RE, '');
    const [lineToComplete, options = {}] = getLineToComplete(preparedLine);

    return getCompletionResult(lineToComplete, options, this.namedTypes);

    function getLineToComplete(signature) {
      if (isTypeSection(signature, nodeIndex)) {
        return [formatLineToComplete(signature), { isTypeSection: true }];
      }

      let currentCharIndex = 0;

      currentCharIndex = skipName(signature, currentCharIndex);
      if (isSignatureEndReached(signature, currentCharIndex)) return [null];

      currentCharIndex = skipDescription(signature, currentCharIndex);
      if (isSignatureEndReached(signature, currentCharIndex)) return [null];

      return getLineFromAttributes(signature, currentCharIndex);
    }
  }
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

  const result = str.substr(startPos, endPos + levels * 2);

  return {
    str: str.substr(startPos + result.length),
    result,
    escaped: str.substr(startPos, (levels - 1) * 2 + result.length),
  };
}

function getCompletionOptions(completionStrings, lineToComplete) {
  return completionStrings
    .filter(i => i.toLocaleLowerCase().indexOf(lineToComplete) === 0)
    .map(str => ({ label: str, kind: CompletionItemKind.Keyword }));
}

function getCompletionResult(lineToComplete, options, namedTypes) {
  if (!lineToComplete) return [];

  if (options.isTypeSection) {
    return getCompletionOptions(typeSections, lineToComplete);
  }

  return [
    ...!options.inSubType && getCompletionOptions(typeAttributes, lineToComplete),
    ...getCompletionOptions(defaultTypes, lineToComplete),
    ...getCompletionOptions(namedTypes, lineToComplete),
  ];
}

function formatLineToComplete(line) {
  return line.trim().toLocaleLowerCase();
}

function isTypeSection(signature, nodeIndex) {
  if (nodeIndex === 0) return false;

  return typeSections.filter(type => (
    type.toLocaleLowerCase().startsWith(signature.toLocaleLowerCase())
  )).length;
}

function isSignatureEndReached(signature, index) {
  return index === signature.length || signature[index] === '-';
}

function skipName(signature, currentIndex) {
  let i = currentIndex;

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

  return i;
}

function skipDescription(signature, currentIndex) {
  let i = currentIndex;

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

  return i;
}

function getLineFromAttributes(signature, index) {
  let strForCompletion = '';
  let i = index + 1;

  let attributeValueContext = false;
  let inSubType = false;
  let slashesNumber = 0;

  while (i < signature.length) {
    if (signature[i] === ')' && !attributeValueContext) return [null];

    if (signature[i] === '[' && !attributeValueContext) {
      inSubType = true;
      strForCompletion = '';
    } else if (signature[i] === ']' && !attributeValueContext) {
      inSubType = false;
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

  return [formatLineToComplete(strForCompletion), { inSubType }];
}

module.exports = CompletionProvider;
