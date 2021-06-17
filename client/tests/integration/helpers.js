// eslint-disable-next-line import/no-unresolved
const vscode = require('vscode');
const path = require('path');

const LS_ACTIVATION_TIMEOUT = 2000;

module.exports = {
  /**
   * @type {vscode.TextDocument}
   */
  doc: null,

  /**
   * @type {vscode.TextEditor}
   */
  editor: null,

  /**
   * Activates the FunBox.vscode-apib-ls extension
   * @param {vscode.Uri} docUri
   */
  async activate(docUri) {
    // The extensionId is `publisher.name` from package.json
    const ext = vscode.extensions.getExtension('FunBox.vscode-apib-ls');
    await ext.activate();
    try {
      this.doc = await vscode.workspace.openTextDocument(docUri);
      this.editor = await vscode.window.showTextDocument(this.doc);

      await new Promise(resolve => setTimeout(resolve, LS_ACTIVATION_TIMEOUT));
    } catch (err) {
      console.error(err);
    }
  },

  /**
   * @param {string} p
   */
  getDocPath(p) {
    return path.resolve(__dirname, '../tmp-fixtures', p);
  },

  /**
   * @param {string} p
   */
  getDocUri(p) {
    return vscode.Uri.file(this.getDocPath(p));
  },

  /**
   * @param {string} content
   * @returns {Thenable<boolean>}
   */
  async setTestContent(content) {
    const all = new vscode.Range(
      this.doc.positionAt(0),
      this.doc.positionAt(this.doc.getText().length),
    );

    return this.editor.edit(eb => eb.replace(all, content));
  },
};
