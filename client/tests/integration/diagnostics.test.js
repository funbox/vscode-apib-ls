const assert = require('assert');
// eslint-disable-next-line import/no-unresolved
const vscode = require('vscode');

const helpers = require('./helpers');

// eslint-disable-next-line func-names
describe('Diagnostics tests', function () {
  this.timeout(60000);

  describe('Should get Error', () => {
    const withErrorUri = helpers.getDocUri('with-error.apib');

    before(async () => {
      await helpers.activate(withErrorUri);
    });

    it('Should get Error', async () => {
      await testDiagnostics(withErrorUri, [{
        message: 'Could not retrieve URI parameters: /users/{id}{,,,}',
        range: new vscode.Range(
          new vscode.Position(5, 0),
          new vscode.Position(7, 0),
        ),
        severity: vscode.DiagnosticSeverity.Error,
      }]);
    });
  });

  describe('Should get Warning', () => {
    const withWarningUri = helpers.getDocUri('with-warning.apib');

    before(async () => {
      await helpers.activate(withWarningUri);
    });

    it('Should get Warning', async () => {
      await testDiagnostics(withWarningUri, [{
        message: 'Action is missing parameter definitions: groupId, status.',
        range: new vscode.Range(
          new vscode.Position(5, 0),
          new vscode.Position(7, 0),
        ),
        severity: vscode.DiagnosticSeverity.Warning,
      }]);
    });
  });
});

/**
 *
 * @param {vscode.Uri} docUri
 * @param {vscode.Diagnostic[]} expectedDiagnostics
 */
async function testDiagnostics(docUri, expectedDiagnostics) {
  const actualDiagnostics = vscode.languages.getDiagnostics(docUri);

  assert.strictEqual(actualDiagnostics.length, expectedDiagnostics.length);

  expectedDiagnostics.forEach((expectedDiagnostic, i) => {
    const actualDiagnostic = actualDiagnostics[i];
    assert.strictEqual(actualDiagnostic.message, expectedDiagnostic.message);
    assert.deepStrictEqual(actualDiagnostic.range, expectedDiagnostic.range);
    assert.strictEqual(actualDiagnostic.severity, expectedDiagnostic.severity);
  });
}
