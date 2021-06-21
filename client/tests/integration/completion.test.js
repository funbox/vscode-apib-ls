const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
// eslint-disable-next-line import/no-unresolved
const vscode = require('vscode');

const helpers = require('./helpers');

// eslint-disable-next-line func-names
describe('Completion tests', function () {
  this.timeout(60000);

  const fixturePath = path.resolve(__dirname, '../tmp-fixtures');
  const fixtureSourcePath = path.resolve(__dirname, '../fixtures');

  const incompleteDataStructures = helpers.getDocUri('incomplete-data-structures.apib');
  const incompleteSectionNamesUri = helpers.getDocUri('incomplete-section-names.apib');

  before(() => {
    fs.copySync(fixtureSourcePath, fixturePath);
  });

  after(() => {
    fs.removeSync(fixturePath);
  });

  describe('Completes section names', () => {
    before(async () => {
      await helpers.activate(incompleteSectionNamesUri);
    });

    it('Completes "Data Structures" keyword', async () => {
      await testCompletion(incompleteSectionNamesUri, new vscode.Position(2, 5), ['Data Structures']);
    });

    it('Completes "Schema Structures" keyword', async () => {
      await testCompletion(incompleteSectionNamesUri, new vscode.Position(3, 4), ['Schema Structures']);
    });

    it('Completes "Resource Prototypes" keyword', async () => {
      await testCompletion(incompleteSectionNamesUri, new vscode.Position(4, 4), ['Resource Prototypes']);
    });

    it('Completes "Group" keyword', async () => {
      await testCompletion(incompleteSectionNamesUri, new vscode.Position(5, 5), ['Group']);
    });

    it('Completes "Import" keyword', async () => {
      await testCompletion(incompleteSectionNamesUri, new vscode.Position(6, 4), ['Import']);
    });
  });

  describe('Completes request methods', () => {
    const incompleteMethodsUri = helpers.getDocUri('incomplete-methods.apib');

    before(async () => {
      await helpers.activate(incompleteSectionNamesUri);
    });

    it('Completes resource methods', async () => {
      const cases = [
        [new vscode.Position(2, 5), ['GET']],
        [new vscode.Position(3, 4), ['PATCH', 'POST', 'PROPPATCH', 'PUT']],
        [new vscode.Position(4, 6), ['DELETE']],
        [new vscode.Position(5, 4), ['OPTIONS']],
        [new vscode.Position(6, 4), ['LINK', 'LOCK']],
        [new vscode.Position(7, 4), ['UNLINK', 'UNLOCK']],
        [new vscode.Position(8, 4), ['CONNECT', 'COPY']],
        [new vscode.Position(9, 4), ['MKCOL', 'MOVE']],
        [new vscode.Position(10, 4), ['HEAD']],
      ];

      await Promise.all(cases.map(async ([position, labels]) => (
        testCompletion(incompleteMethodsUri, position, labels)
      )));
    });

    it('Completes named resource methods ', async () => {
      const cases = [
        [new vscode.Position(14, 11), ['GET']],
        [new vscode.Position(15, 11), ['PATCH', 'POST', 'PROPPATCH', 'PUT']],
        [new vscode.Position(16, 11), ['DELETE']],
        [new vscode.Position(17, 11), ['OPTIONS']],
        [new vscode.Position(18, 11), ['LINK', 'LOCK']],
        [new vscode.Position(19, 11), ['UNLINK', 'UNLOCK']],
        [new vscode.Position(20, 11), ['CONNECT', 'COPY']],
        [new vscode.Position(21, 11), ['MKCOL', 'MOVE']],
        [new vscode.Position(22, 11), ['HEAD']],
      ];

      await Promise.all(cases.map(async ([position, labels]) => (
        testCompletion(incompleteMethodsUri, position, labels)
      )));
    });
  });

  describe('Completes Import', () => {
    const incompleteImportUri = helpers.getDocUri('incomplete-import.apib');

    before(async () => {
      await helpers.activate(incompleteImportUri);
    });

    it('Completes files for Import', async () => {
      await testCompletion(incompleteImportUri, new vscode.Position(2, 15), [
        'nested-a.apib',
        'nested-b.apib',
      ]);
    });
  });

  describe('Completes Resource Prototypes', () => {
    const incompleteResourcePrototype = helpers.getDocUri('incomplete-resource-prototype.apib');

    before(async () => {
      await helpers.activate(incompleteResourcePrototype);
    });

    it('Completes Resource Prototype', async () => {
      await testCompletion(incompleteResourcePrototype, new vscode.Position(6, 3), ['Response']);
    });

    it('Completes Response in Resource Prototype', async () => {
      await testCompletion(incompleteResourcePrototype, new vscode.Position(11, 7), ['Schema']);
      await testCompletion(incompleteResourcePrototype, new vscode.Position(12, 7), ['Attributes']);
      await testCompletion(incompleteResourcePrototype, new vscode.Position(13, 7), ['Body']);
    });

    it('Completes types in Attributes of Response', async () => {
      await testCompletion(incompleteResourcePrototype, new vscode.Position(19, 19), ['enum']);
    });
  });

  describe('Completes Resource Prototype with data structure', () => {
    const incompleteResourcePrototypeAndDataStructure = helpers.getDocUri('incomplete-resource-prototype-and-data-structure.apib');

    before(async () => {
      await helpers.activate(incompleteResourcePrototypeAndDataStructure);
    });

    it('Completes resource prototype with data structure', async () => {
      await testCompletion(incompleteResourcePrototypeAndDataStructure, new vscode.Position(13, 19), ['UserRole']);
    });
  });

  describe('Completes Data Structures', () => {
    before(async () => {
      await helpers.activate(incompleteDataStructures);
    });

    it('Completes Data Structures', async () => {
      await testCompletion(incompleteDataStructures, new vscode.Position(9, 12), ['string']);
      await testCompletion(incompleteDataStructures, new vscode.Position(10, 13), ['number']);
      await testCompletion(incompleteDataStructures, new vscode.Position(11, 12), ['boolean']);
      await testCompletion(incompleteDataStructures, new vscode.Position(12, 11), ['file']);
      await testCompletion(incompleteDataStructures, new vscode.Position(13, 12), ['object']);
      await testCompletion(incompleteDataStructures, new vscode.Position(14, 10), ['array']);
      await testCompletion(incompleteDataStructures, new vscode.Position(15, 9), ['enum']);
    });

    it('Completes Type Attributes', async () => {
      await testCompletion(incompleteDataStructures, new vscode.Position(19, 13), ['required']);
      await testCompletion(incompleteDataStructures, new vscode.Position(20, 21), ['fixed', 'fixed-type']);
      await testCompletion(incompleteDataStructures, new vscode.Position(21, 12), ['format']);
      await testCompletion(incompleteDataStructures, new vscode.Position(22, 14), ['optional']);
      await testCompletion(incompleteDataStructures, new vscode.Position(23, 15), ['nullable']);
      await testCompletion(incompleteDataStructures, new vscode.Position(24, 12), ['pattern']);
      await testCompletion(incompleteDataStructures, new vscode.Position(25, 37), ['max-length', 'maximum', 'min-length', 'minimum']);
      await testCompletion(incompleteDataStructures, new vscode.Position(26, 12), ['default']);
      await testCompletion(incompleteDataStructures, new vscode.Position(27, 12), ['sample']);
    });

    it('Completes Default Type and Type Attribute', async () => {
      await testCompletion(incompleteDataStructures, new vscode.Position(31, 21), ['required']);
    });

    it('Completes Nested Type', async () => {
      await testCompletion(incompleteDataStructures, new vscode.Position(35, 11), ['Child']);
    });
  });

  describe('Completes Resource Group', () => {
    describe('Completes Resource Parameters', () => {
      const incompleteResourceUri = helpers.getDocUri('incomplete-resource-group.apib');

      before(async () => {
        await helpers.activate(incompleteResourceUri);
      });

      it('Completes Resource Parameters', async () => {
        await testCompletion(incompleteResourceUri, new vscode.Position(6, 3), ['Parameters']);
      });

      it('Completes Resource Request and Response', async () => {
        await testCompletion(incompleteResourceUri, new vscode.Position(7, 3), ['Request', 'Response']);
      });
    });

    describe('Completes Resource Response', () => {
      const incompleteResourceResponesUri = helpers.getDocUri('incomplete-resource-group-response.apib');

      before(async () => {
        await helpers.activate(incompleteResourceResponesUri);
      });

      it('Completes Resource Response', async () => {
        await testCompletion(incompleteResourceResponesUri, new vscode.Position(7, 7), ['Attributes']);
        await testCompletion(incompleteResourceResponesUri, new vscode.Position(8, 7), ['Body']);
        await testCompletion(incompleteResourceResponesUri, new vscode.Position(9, 7), ['Schema']);
      });
    });
  });

  describe('Completes Resource', () => {
    const incompleteResourceUri = helpers.getDocUri('incomplete-resource.apib');

    before(async () => {
      await helpers.activate(incompleteResourceUri);
    });

    it('Completes Resource Response and Request', async () => {
      await testCompletion(incompleteResourceUri, new vscode.Position(4, 3), ['Request', 'Response']);
    });
  });
});

/**
 * @param {vscode.Uri} docUri
 * @param {vscode.Position} position
 * @param {string[]} label
 * @returns {Promise<void>}
 */
async function testCompletion(docUri, position, labels) {
  const actualCompletionList = await vscode.commands.executeCommand(
    'vscode.executeCompletionItemProvider',
    docUri,
    position,
  );

  assert.ok(actualCompletionList.items.length === labels.length);

  labels.forEach((label, i) => {
    const actualItem = actualCompletionList.items[i];
    assert.strictEqual(actualItem.label, label);
    assert.strictEqual(actualItem.kind, vscode.CompletionItemKind.Keyword);
  });
}
