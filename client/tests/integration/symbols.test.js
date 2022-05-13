const assert = require('assert');
// eslint-disable-next-line import/no-unresolved
const vscode = require('vscode');

const helpers = require('./helpers');

describe('Symbols test', () => {
  describe('Data Structures', () => {
    const dataStructuresUri = helpers.getDocUri('symbols-data-structures.apib');

    before(async () => {
      await helpers.activate(dataStructuresUri);
    });

    it('Should get Data Structures Symbols', async () => {
      await testSymbols(dataStructuresUri, [
        {
          name: 'Data Structures',
          kind: vscode.SymbolKind.Namespace,
          location: {
            range: new vscode.Range(2, 0, 5, 13),
          },
          children: [
            {
              name: 'User',
              kind: vscode.SymbolKind.Class,
              location: {
                range: new vscode.Range(4, 0, 5, 13),
              },
            },
          ],
        },
      ]);
    });
  });

  describe('Schema Structures', () => {
    const schemaStructuresUri = helpers.getDocUri('symbols-schema-structures.apib');

    before(async () => {
      await helpers.activate(schemaStructuresUri);
    });

    it('Should get Schema Structures Symbols', async () => {
      await testSymbols(schemaStructuresUri, [
        {
          name: 'Schema Structures',
          kind: vscode.SymbolKind.Namespace,
          location: {
            range: new vscode.Range(2, 0, 44, 7),
          },
          children: [
            {
              name: 'Message',
              kind: vscode.SymbolKind.Class,
              location: {
                range: new vscode.Range(4, 0, 24, 0),
              },
            },
            {
              name: 'User',
              kind: vscode.SymbolKind.Class,
              location: {
                range: new vscode.Range(25, 0, 44, 7),
              },
            },
          ],
        },
      ]);
    });
  });

  describe('Resource Prototypes', () => {
    const resourcesPrototypesUri = helpers.getDocUri('symbols-resource-prototypes.apib');

    before(async () => {
      await helpers.activate(resourcesPrototypesUri);
    });

    it('Should get Resource Prototypes Symbols', async () => {
      await testSymbols(resourcesPrototypesUri, [
        {
          name: 'Resource Prototypes',
          kind: vscode.SymbolKind.Namespace,
          location: {
            range: new vscode.Range(2, 0, 7, 0),
          },
          children: [
            {
              name: 'NotFound',
              kind: vscode.SymbolKind.Class,
              location: {
                range: new vscode.Range(4, 0, 7, 0),
              },
              children: {
                name: 'Response 404',
                kind: vscode.SymbolKind.Method,
                location: {
                  range: new vscode.Range(6, 0, 7, 0),
                },
              },
            },
          ],
        },
        {
          name: 'Users [/users]',
          kind: vscode.SymbolKind.Module,
          location: {
            range: new vscode.Range(8, 0, 10, 17),
          },
          children: [
            {
              name: 'GET',
              kind: vscode.SymbolKind.Module,
              location: {
                range: new vscode.Range(10, 0, 10, 17),
              },
            },
          ],
        },
      ]);
    });
  });

  describe('Resource Group', () => {
    const resourceGroupUri = helpers.getDocUri('symbols-resource-group.apib');

    before(async () => {
      await helpers.activate(resourceGroupUri);
    });

    it('Should get Resource Group Symbols', async () => {
      await testSymbols(resourceGroupUri, [
        {
          name: 'Users',
          kind: vscode.SymbolKind.Namespace,
          location: {
            range: new vscode.Range(2, 0, 8, 14),
          },
          children: [
            {
              name: 'Users [/users]',
              kind: vscode.SymbolKind.Module,
              location: {
                range: new vscode.Range(4, 0, 8, 14),
              },
              children: [
                {
                  name: 'GET',
                  kind: vscode.SymbolKind.Module,
                  location: {
                    range: new vscode.Range(6, 0, 8, 14),
                  },
                  children: [
                    {
                      name: 'Response 200',
                      kind: vscode.SymbolKind.Method,
                      location: {
                        range: new vscode.Range(8, 0, 8, 14),
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ]);
    });
  });

  describe('Action', () => {
    const actionUri = helpers.getDocUri('symbols-action.apib');

    before(async () => {
      await helpers.activate(actionUri);
    });

    it('Should get Action Symbols', async () => {
      await testSymbols(actionUri, [
        {
          name: 'Profile [GET /profile]',
          kind: vscode.SymbolKind.Module,
          location: {
            range: new vscode.Range(2, 0, 8, 14),
          },
          children: [
            {
              name: 'Request GET',
              kind: vscode.SymbolKind.Method,
              location: {
                range: new vscode.Range(4, 0, 7, 0),
              },
            },
            {
              name: 'Response 200',
              kind: vscode.SymbolKind.Method,
              location: {
                range: new vscode.Range(8, 0, 8, 14),
              },
            },
          ],
        },
      ]);
    });
  });
});

/**
 * @param {vscode.Uri} docUri
 * @param {(vscode.SymbolInformation[]|vscode.DocumentSymbol[])} symbols
 * @param {(vscode.SymbolInformation[]|vscode.DocumentSymbol[])} actualSymbols
 * @returns {Promise<void>}
 */
async function testSymbols(docUri, symbols, actualSymbols) {
  const actualSymbolsList = actualSymbols || await getActualSymbolsList(docUri);
  const children = [];

  assert.ok(actualSymbolsList.length === symbols.length);

  symbols.forEach((symbol, i) => {
    assert.strictEqual(actualSymbolsList[i].name, symbol.name);
    assert.strictEqual(actualSymbolsList[i].kind, symbol.kind);
    assert.deepStrictEqual(actualSymbolsList[i].location.range, symbol.location.range);

    if (symbol.children && symbol.children.length) {
      children.push(testSymbols(docUri, symbol.children, actualSymbolsList[i].children));
    }
  });

  await Promise.all(children);
}

/**
 * @param {vscode.Uri} docUri
 * @returns {(vscode.SymbolInformation[]|vscode.DocumentSymbol[])}
 */
async function getActualSymbolsList(docUri) {
  const actualSymbolsList = await vscode.commands.executeCommand(
    'vscode.executeDocumentSymbolProvider',
    docUri,
  );

  return actualSymbolsList;
}
