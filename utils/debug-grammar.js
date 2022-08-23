/**
 * Add env variable `VSCODE_TEXTMATE_DEBUG=true` to run script with extra debugging info
 * Example: `VSCODE_TEXTMATE_DEBUG=true node utils/debug-grammar.js example.apib`
 */

const fs = require('fs');
const path = require('path');
const vsctm = require('vscode-textmate');
const oniguruma = require('vscode-oniguruma');

const FILE_PATH = process.argv[2];

const fileContents = fs.readFileSync(FILE_PATH, { encoding: 'utf-8' });
const fileLines = fileContents.split(/\r\n|\r|\n/);

const scopeToGrammar = {
  'text.html.markdown.source.gfm.apib': getPath('../syntax/APIBlueprint.tmLanguage'),
  'text.html.markdown.source.gfm.mson': getPath('../syntax/MSON.tmLanguage'),
  'source.js': getPath('../syntax/JavaScript.tmLanguage'),
  'text.html.basic': getPath('../syntax/html.tmLanguage'),
};

const wasmBin = fs.readFileSync(getPath('../node_modules/vscode-oniguruma/release/onig.wasm')).buffer;
const vscodeOnigurumaLib = oniguruma.loadWASM(wasmBin).then(() => ({
  createOnigScanner(patterns) { return new oniguruma.OnigScanner(patterns); },
  createOnigString(s) { return new oniguruma.OnigString(s); },
}));

// Create a registry that can create a grammar from a scope name.
const registry = new vsctm.Registry({
  onigLib: vscodeOnigurumaLib,
  loadGrammar: (scopeName) => {
    const pathToGrammar = scopeToGrammar[scopeName];

    if (pathToGrammar) {
      return fs.promises.readFile(pathToGrammar, { encoding: 'utf-8' }).then(data => vsctm.parseRawGrammar(data, pathToGrammar));
    }
    console.log(`Unknown scope name: ${scopeName}`);
    return null;
  },
});

// Load the JavaScript grammar and any other grammars included by it async.
registry.loadGrammar('text.html.markdown.source.gfm.apib').then(grammar => {
  let ruleStack = vsctm.INITIAL;
  for (let i = 0; i < fileLines.length; i++) {
    const line = fileLines[i];
    const lineTokens = grammar.tokenizeLine(line, ruleStack);
    console.log(`\nTokenizing line: ${line}`);
    for (let j = 0; j < lineTokens.tokens.length; j++) {
      const token = lineTokens.tokens[j];
      console.log(` - token from ${token.startIndex} to ${token.endIndex} `
        + `(${line.substring(token.startIndex, token.endIndex)}) `
        + `with scopes ${token.scopes.join(', ')}`);
    }
    ruleStack = lineTokens.ruleStack;
  }
});

function getPath(relativePath) {
  return path.resolve(__dirname, relativePath);
}
