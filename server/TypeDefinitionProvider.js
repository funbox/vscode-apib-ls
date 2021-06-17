const crafter = require('@funbox/crafter');
const {
  get,
  calculateCrafterParams,
  DocumentURI,
  extractSymbols,
  getPosInBytes,
  positionBelongsToNode,
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
    const transitionNode = node.content.find(n => n.element === 'transition' && positionBelongsToNode(pos, n));

    if (transitionNode) {
      for (let j = 0; j < transitionNode.content.length; j++) {
        const requestOrResponseNode = transitionNode.content[j].content.find(n => positionBelongsToNode(pos, n));

        if (requestOrResponseNode) {
          return this.getDefinitionLocationFromRequestOrResponse(pos, requestOrResponseNode);
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

module.exports = TypeDefinitionProvider;
