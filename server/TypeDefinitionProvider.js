const crafter = require('@funbox/crafter');
const {
  get,
  calculateCrafterParams,
  DocumentURI,
  extractSymbols,
} = require('./utils');

class TypeDefinitionProvider {
  constructor(serverState) {
    this.serverState = serverState;
  }

  async getDefinitionLocation(typeParam) {
    const textDocument = this.serverState.documents.get(typeParam.textDocument.uri);
    const offset = getPosInBytes(textDocument.getText(), typeParam.position);

    const { text, options, entryPath } = await calculateCrafterParams(textDocument, this.serverState);

    let file;

    const textDocumentURI = DocumentURI.createFromURI(typeParam.textDocument.uri);
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
    this.namedTypes = symbols.namedTypes;
    this.resourcePrototypes = symbols.resourcePrototypes;

    return this.getDefinitionLocationFromRefract(pos, refract.content[0]);
  }

  getDefinitionLocationFromRefract(pos, rootNode) {
    if (!positionBelongsToNode(pos, rootNode)) return undefined;

    const nodeForPosition = rootNode.content.find(node => positionBelongsToNode(pos, node));
    if (!nodeForPosition) return undefined;

    if (nodeForPosition.element === 'category') {
      const categoryClass = get('meta', 'classes', 'content', 0, 'content').from(nodeForPosition);
      if (categoryClass === 'resourceGroup') {
        return this.getDefinitionLocationFromResourceGroup(pos, nodeForPosition);
      }

      if (categoryClass === 'dataStructures') {
        return this.getDefinitionLocationFromDataStructures(pos, nodeForPosition);
      }

      if (categoryClass === 'resourcePrototypes') {
        return this.getDefinitionLocationFromResourcePrototypes(pos, nodeForPosition);
      }
    }

    if (nodeForPosition.element === 'resource') {
      return this.getDefinitionLocationFromResource(pos, nodeForPosition);
    }
    return undefined;
  }

  getDefinitionLocationFromResourceGroup(pos, node) {
    const nodeForPosition = node.content.find(n => positionBelongsToNode(pos, n));

    if (nodeForPosition && nodeForPosition.element === 'resource') {
      return this.getDefinitionLocationFromResource(pos, nodeForPosition);
    }

    const prototype = this.getResourcePrototypeForNode(pos, node);
    if (prototype) return prototype;

    return undefined;
  }

  getDefinitionLocationFromResource(pos, node) {
    for (let i = 0; i < node.content.length; i++) {
      const transitionNode = node.content[i];
      if (transitionNode.element === 'transition') {
        for (let j = 0; j < transitionNode.content.length; j++) {
          const [requestNode, responseNode] = transitionNode.content[j].content;

          if (positionBelongsToNode(pos, requestNode)) {
            return this.getDefinitionLocationFromRequestOrResponse(pos, requestNode);
          }

          if (positionBelongsToNode(pos, responseNode)) {
            return this.getDefinitionLocationFromRequestOrResponse(pos, responseNode);
          }
        }
      }

      const prototype = this.getResourcePrototypeForNode(pos, transitionNode);
      if (prototype) return prototype;
    }

    const prototype = this.getResourcePrototypeForNode(pos, node);
    if (prototype) return prototype;

    return undefined;
  }

  getDefinitionLocationFromRequestOrResponse(pos, node) {
    const nodeForPosition = node.content.find(n => positionBelongsToNode(pos, n));

    if (nodeForPosition && nodeForPosition.element === 'dataStructure') {
      return this.getDefinitionLocationFromDataStructure(pos, nodeForPosition.content);
    }

    return undefined;
  }

  getDefinitionLocationFromDataStructures(pos, node) {
    const nodeForPosition = node.content.find(n => positionBelongsToNode(pos, n));

    if (nodeForPosition) {
      return this.getDefinitionLocationFromDataStructure(pos, nodeForPosition.content);
    }

    return undefined;
  }

  getDefinitionLocationFromDataStructure(pos, node) {
    if (Array.isArray(node.content)) {
      const nodeForPosition = node.content.find(n => positionBelongsToNode(pos, n));

      if (nodeForPosition) {
        if (nodeForPosition.element === 'member') {
          const value = nodeForPosition.content.value;
          if (positionBelongsToNode(pos, value)) {
            return this.getDefinitionLocationFromDataStructure(pos, value);
          }
        } else if (nodeForPosition.element === 'ref') {
          return this.namedTypes.get(nodeForPosition.content);
        } else {
          return this.getDefinitionLocationFromDataStructure(pos, nodeForPosition);
        }
      }
    }

    const element = node.element;
    if (this.namedTypes.has(element)) {
      return this.namedTypes.get(element);
    }

    return undefined;
  }

  getDefinitionLocationFromResourcePrototypes(pos, node) {
    for (let i = 0; i < node.content.length; i++) {
      const prototypeNode = node.content[i];
      const prototype = this.getResourcePrototypeForNode(pos, prototypeNode);
      if (prototype) return prototype;
    }

    return undefined;
  }

  getResourcePrototypeForNode(pos, node) {
    const prototypes = node.attributes.prototypes ? node.attributes.prototypes.content : [];
    const prototypeForPosition = prototypes.find(p => positionBelongsToNode(pos, p));

    if (prototypeForPosition) {
      const prototypeName = prototypeForPosition.content;
      if (this.resourcePrototypes.has(prototypeName)) {
        return this.resourcePrototypes.get(prototypeName);
      }
    }

    return undefined;
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

module.exports = TypeDefinitionProvider;
