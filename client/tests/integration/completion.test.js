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
      await testCompletion(incompleteSectionNamesUri, new vscode.Position(2, 5), {
        items: [
          { label: 'Data Structures', kind: vscode.CompletionItemKind.Keyword },
        ],
      });
    });

    it('Completes "Schema Structures" keyword', async () => {
      await testCompletion(incompleteSectionNamesUri, new vscode.Position(3, 4), {
        items: [
          { label: 'Schema Structures', kind: vscode.CompletionItemKind.Keyword },
        ],
      });
    });

    it('Completes "Resource Prototypes" keyword', async () => {
      await testCompletion(incompleteSectionNamesUri, new vscode.Position(4, 4), {
        items: [
          { label: 'Resource Prototypes', kind: vscode.CompletionItemKind.Keyword },
        ],
      });
    });

    it('Completes "Group" keyword', async () => {
      await testCompletion(incompleteSectionNamesUri, new vscode.Position(5, 5), {
        items: [
          { label: 'Group', kind: vscode.CompletionItemKind.Keyword },
        ],
      });
    });

    it('Completes "Import" keyword', async () => {
      await testCompletion(incompleteSectionNamesUri, new vscode.Position(6, 4), {
        items: [
          { label: 'Import', kind: vscode.CompletionItemKind.Keyword },
        ],
      });
    });
  });
});

/**
 * @param {vscode.Uri} docUri
 * @param {vscode.Position} position
 * @param {vscode.CompletionList} expectedCompletionList
 * @returns {Promise<void>}
 */
async function testCompletion(docUri, position, expectedCompletionList) {
  const actualCompletionList = (await vscode.commands.executeCommand(
    'vscode.executeCompletionItemProvider',
    docUri,
    position,
  ));

  assert.ok(actualCompletionList.items.length === expectedCompletionList.items.length);

  expectedCompletionList.items.forEach((expectedItem, i) => {
    const actualItem = actualCompletionList.items[i];
    assert.strictEqual(actualItem.label, expectedItem.label);
    assert.strictEqual(actualItem.kind, expectedItem.kind);
  });
}
