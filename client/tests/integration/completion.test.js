const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
// eslint-disable-next-line import/no-unresolved
const vscode = require('vscode');

const helpers = require('./helpers');

describe('Extension test', function () {
  this.timeout(60000);

  const fixturePath = path.resolve(__dirname, '../tmp-fixtures');
  const fixtureSourcePath = path.resolve(__dirname, '../fixtures');

  const incompleteImportUri = helpers.getDocUri('incomplete-import.apib');
  const incompleteMethodsUri = helpers.getDocUri('incomplete-methods.apib');
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

  describe('Completes import', () => {
    before(async () => {
      await helpers.activate(incompleteImportUri);
    });

    it('Completes files for import', async () => {
      await testCompletion(incompleteImportUri, new vscode.Position(2, 15), [
        'nested-a.apib',
        'nested-b.apib',
      ]);
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
  const actualCompletionList = (await vscode.commands.executeCommand(
    'vscode.executeCompletionItemProvider',
    docUri,
    position,
  ));

  assert.ok(actualCompletionList.items.length === labels.length);

  labels.forEach((label, i) => {
    const actualItem = actualCompletionList.items[i];
    assert.strictEqual(actualItem.label, label);
    assert.strictEqual(actualItem.kind, vscode.CompletionItemKind.Keyword);
  });
}
