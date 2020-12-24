const {
  SymbolKind,
} = require('vscode-languageserver');
const crafter = require('@funbox/crafter');
const {
  get,
  belongsToCurrentFile,
  calculateCrafterParams,
  getRangeForNode,
  getSM,
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
      if (!belongsToCurrentFile(node, options, entryPath, textDocument)) {
        return;
      }
      if (node.element === 'category') {
        const categoryClass = get('meta', 'classes', 'content', 0, 'content').from(node);
        switch (categoryClass) {
          case 'dataStructures':
            processDataStructures(node);
            break;
          case 'schemaStructures':
            processSchemaStructures(node);
            break;
          case 'resourcePrototypes':
            processResourcePrototypes(node);
            break;
          case 'resourceGroup':
            processResourceGroup(node);
            break;
          // no default
        }
      }

      if (node.element === 'resource') {
        processResourceOrEndpoint(node);
      }
    });

    return result;

    function processDataStructures(node) {
      result.push({
        name: 'Data Structures',
        kind: SymbolKind.Namespace,
        location: {
          uri: null,
          range: getRangeForNode(node, textDocument, currentDocumentBuffer),
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
          range: getRangeForNode(node, textDocument, currentDocumentBuffer),
        },
      });
    }

    function processSchemaStructures(node) {
      result.push({
        name: 'Schema Structures',
        kind: SymbolKind.Namespace,
        location: {
          uri: null,
          range: getRangeForNode(node, textDocument, currentDocumentBuffer),
        },
      });

      node.content.forEach(namedType => processSchemaType(namedType));
    }

    function processSchemaType(node) {
      result.push({
        name: get('meta', 'id', 'content').from(node),
        kind: SymbolKind.Class,
        location: {
          uri: null,
          range: getRangeForNode(node, textDocument, currentDocumentBuffer),
        },
      });
    }

    function processResourcePrototypes(node) {
      result.push({
        name: 'Resource Prototypes',
        kind: SymbolKind.Namespace,
        location: {
          uri: null,
          range: getRangeForNode(node, textDocument, currentDocumentBuffer),
        },
      });

      node.content.forEach(resourcePrototype => processResourcePrototype(resourcePrototype));
    }

    function processResourcePrototype(node) {
      result.push({
        name: get('meta', 'title', 'content').from(node),
        kind: SymbolKind.Class,
        location: {
          uri: null,
          range: getRangeForNode(node, textDocument, currentDocumentBuffer),
        },
      });
    }

    function processResourceGroup(node) {
      result.push({
        name: get('meta', 'title', 'content').from(node),
        kind: SymbolKind.Namespace,
        location: {
          uri: null,
          range: getRangeForNode(node, textDocument, currentDocumentBuffer),
        },
      });

      node.content.forEach(section => {
        if (section.element === 'resource') {
          processResourceOrEndpoint(section);
        }

        if (section.element === 'message') {
          processMessage(section);
        }

        if (section.element === 'category' && get('meta', 'classes', 'content', 0, 'content').from(section) === 'subGroup') {
          processSubGroup(section);
        }
      });
    }

    function processResourceOrEndpoint(node) {
      if (isNamedEndpoint(node)) {
        processNamedEndpoint(node);
      } else {
        processResource(node);
      }
    }

    function isNamedEndpoint(resource) {
      if (resource.content.length !== 1) return false;
      const transition = resource.content[0];

      const resourceTitle = get('meta', 'title', 'content').from(resource);
      const resourceHref = get('attributes', 'href', 'content').from(resource);
      const transitionTitle = get('meta', 'title', 'content').from(transition);
      const transitionHref = get('attributes', 'href', 'content').from(transition);

      return resourceTitle === transitionTitle && resourceHref === transitionHref;
    }

    function processNamedEndpoint(node) {
      const title = get('meta', 'title', 'content').from(node);
      const transition = node.content[0];
      const method = get('content', 0, 'attributes', 'method', 'content').from(getHTTPTransactions(transition)[0]);
      const href = get('attributes', 'href', 'content').from(node);
      const name = title ? `${title} [${method} ${href}]` : `${method} ${href}`;
      result.push({
        name,
        kind: SymbolKind.Module,
        location: {
          uri: null,
          range: getRangeForNode(node, textDocument, currentDocumentBuffer),
        },
      });

      processTransitionContents(transition);
    }

    function processSubGroup(node) {
      result.push({
        name: get('meta', 'title', 'content').from(node),
        kind: SymbolKind.Module,
        location: {
          uri: null,
          range: getRangeForNode(node, textDocument, currentDocumentBuffer),
        },
      });

      node.content.forEach(message => {
        if (message.element === 'message') {
          processMessage(message);
        }
      });
    }

    function processMessage(node) {
      result.push({
        name: get('meta', 'title', 'content').from(node),
        kind: SymbolKind.Method,
        location: {
          uri: null,
          range: getRangeForNode(node, textDocument, currentDocumentBuffer),
        },
      });
    }

    function processResource(node) {
      const title = get('meta', 'title', 'content').from(node);
      const href = get('attributes', 'href', 'content').from(node);
      const name = title ? `${title} [${href}]` : href;
      result.push({
        name,
        kind: SymbolKind.Module,
        location: {
          uri: null,
          range: getRangeForNode(node, textDocument, currentDocumentBuffer),
        },
      });

      node.content.forEach(transition => processTransition(transition));
    }

    function processTransition(node) {
      const title = get('meta', 'title', 'content').from(node);
      const href = get('attributes', 'href', 'content').from(node);
      const method = get('content', 0, 'attributes', 'method', 'content').from(getHTTPTransactions(node)[0]);

      let name = method;
      if (href) name = `${name} ${href}`;
      if (title) name = `${title} [${name}]`;

      result.push({
        name,
        kind: SymbolKind.Module,
        location: {
          uri: null,
          range: getRangeForNode(node, textDocument, currentDocumentBuffer),
        },
      });

      processTransitionContents(node);
    }

    function processTransitionContents(node) {
      const requests = new Set();
      const responses = new Set();

      getHTTPTransactions(node).forEach(httpTransaction => {
        httpTransaction.content.forEach(item => {
          let processor;
          let items;

          if (item.element === 'httpRequest') {
            processor = processRequest;
            items = requests;
          } else if (item.element === 'httpResponse') {
            processor = processResponse;
            items = responses;
          } else {
            return;
          }


          const sm = getSM(item);
          if (!sm) return;
          const itemSM = `${sm[0].content}-${sm[1].content}`;
          if (items.has(itemSM)) return;

          items.add(itemSM);
          processor(item);
        });
      });
    }

    function processRequest(node) {
      const name = `Request ${get('attributes', 'method', 'content').from(node)}`;
      result.push({
        name,
        kind: SymbolKind.Method,
        location: {
          uri: null,
          range: getRangeForNode(node, textDocument, currentDocumentBuffer),
        },
      });
    }

    function processResponse(node) {
      if (!belongsToCurrentFile(node, options, entryPath, textDocument)) return; // Resource Prototypes
      const name = `Response ${get('attributes', 'statusCode', 'content').from(node)}`;
      result.push({
        name,
        kind: SymbolKind.Method,
        location: {
          uri: null,
          range: getRangeForNode(node, textDocument, currentDocumentBuffer),
        },
      });
    }
  }
}

function getHTTPTransactions(node) {
  return node.content.filter(item => item.element === 'httpTransaction');
}

module.exports = SymbolsProcessor;
