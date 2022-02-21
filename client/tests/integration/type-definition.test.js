const assert = require('assert');
// eslint-disable-next-line import/no-unresolved
const vscode = require('vscode');

const helpers = require('./helpers');

describe('Type Definition tests', () => {
  describe('Resource Group', () => {
    const resourceGroupUri = helpers.getDocUri('type-definition-resource-group.apib');

    before(async () => {
      await helpers.activate(resourceGroupUri);
    });

    xit('Should go to Resource Prototype', async () => {
      await testTypeDefinition(resourceGroupUri, new vscode.Position(23, 14), [
        { range: new vscode.Range(14, 0, 18, 0) },
      ]);
    });

    xit('Should go to Data Structure', async () => {
      await testTypeDefinition(resourceGroupUri, new vscode.Position(26, 20), [
        { range: new vscode.Range(8, 0, 11, 0) },
      ]);
    });
  });

  describe('Data Structures', () => {
    const dataStructuresUri = helpers.getDocUri('type-definition-data-structures.apib');

    before(async () => {
      await helpers.activate(dataStructuresUri);
    });

    xit('Should go to Parent Type', async () => {
      await testTypeDefinition(dataStructuresUri, new vscode.Position(8, 20), [
        { range: new vscode.Range(4, 0, 7, 0) },
      ]);
    });
  });

  describe('Resource Prototypes', () => {
    const resourcePrototypesUri = helpers.getDocUri('type-definition-resource-prototypes.apib');

    before(async () => {
      await helpers.activate(resourcePrototypesUri);
    });

    xit('Should go to Parent Resource Prototype', async () => {
      await testTypeDefinition(resourcePrototypesUri, new vscode.Position(14, 14), [
        { range: new vscode.Range(9, 0, 13, 0) },
      ]);
    });

    // TODO: Add tests for "go to Data Structure" capability
  });

  describe('Resource', () => {
    const resourceUri = helpers.getDocUri('type-definition-resource.apib');

    before(async () => {
      await helpers.activate(resourceUri);
    });

    xit('Should go to Resource Prototype', async () => {
      await testTypeDefinition(resourceUri, new vscode.Position(14, 25), [
        { range: new vscode.Range(10, 0, 13, 0) },
      ]);
    });

    xit('Should go to Data Structure', async () => {
      await testTypeDefinition(resourceUri, new vscode.Position(17, 19), [
        { range: new vscode.Range(4, 0, 7, 0) },
      ]);
    });
  });
});

/**
 * @param {vscode.Uri} docUri
 * @param {vscode.Position} position
 * @param {(vscode.Definition[]|vscode.DefinitionLink[])} typeDefinitionList
 * @returns {Promise<void>}
 */
async function testTypeDefinition(docUri, position, typeDefinitionList) {
  const actualTypeDefinitionList = await vscode.commands.executeCommand(
    'vscode.executeTypeDefinitionProvider',
    docUri,
    position,
  );

  assert.ok(actualTypeDefinitionList.length === typeDefinitionList.length);

  typeDefinitionList.forEach((item, i) => {
    assert.deepStrictEqual(actualTypeDefinitionList[i].range, item.range);
  });
}
