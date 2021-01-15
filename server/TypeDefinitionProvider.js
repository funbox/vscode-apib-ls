const path = require('path');
const fs = require('fs');
const crafter = require('@funbox/crafter');
const {
  get,
  calculateCrafterParams,
  getRangeForNode,
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

    if ((new URL(typeParam.textDocument.uri)).pathname !== entryPath) {
      file = (new URL(typeParam.textDocument.uri)).pathname;

      let entryDir = options.entryDir;
      if (entryDir[entryDir.length - 1] !== '/') entryDir = `${entryDir}/`;
      if (file.indexOf(entryDir) === 0) {
        file = file.replace(entryDir, '');
      }
    }

    const pos = { offset, file };

    options.languageServerMode = true;
    const refract = (await crafter.parse(text, options))[0].toRefract(true);
    await this.extractNamedTypes(refract.content[0], options.entryDir, entryPath);

    return this.getDefinitionLocationFromRefract(pos, refract.content[0]);
  }

  async extractNamedTypes(rootNode, entryDir, entryPath) {
    this.namedTypes = new Map();

    const buffers = new Map();

    for (let i = 0; i < rootNode.content.length; i++) {
      const node = rootNode.content[i];

      if (node.element === 'category') {
        const categoryClass = get('meta', 'classes', 'content', 0, 'content').from(node);
        if (categoryClass === 'dataStructures') {
          for (let j = 0; j < node.content.length; j++) {
            const namedType = node.content[j];
            const fileName = get('attributes', 'sourceMap', 'content', 0, 'file').from(node);
            const filePath = fileName ? path.join(entryDir, fileName) : entryPath;
            const uri = `file://${filePath}`;
            let buffer;
            let textDocument;

            if (buffers.has(uri)) {
              buffer = buffers.get(uri);
            } else if (this.serverState.documents.get(uri)) {
              textDocument = this.serverState.documents.get(uri);
              buffer = Buffer.from(textDocument.getText());
              buffers.set(uri, buffer);
            } else {
              buffer = await fs.promises.readFile(filePath);
              buffers.set(uri, buffer);
            }

            const name = get('content', 'meta', 'id', 'content').from(namedType);
            const location = {
              uri,
              range: getRangeForNode(namedType, buffer),
            };
            this.namedTypes.set(name, location);
          }
        }
      }
    }
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
    }

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
