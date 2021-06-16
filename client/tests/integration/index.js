const path = require('path');
const Mocha = require('mocha');
const glob = require('glob');

function run(testsRoot, cb) {
  // Create the mocha test
  const mocha = new Mocha({
    color: true,
  });

  glob('**/**.test.js', { cwd: testsRoot }, (error, files) => {
    if (error) {
      cb(error);
      return;
    }

    // Add files to the test suite
    files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

    try {
      // Run the mocha test
      mocha.run(failures => cb(null, failures));
    } catch (err) {
      console.error(err);
      cb(err);
    }
  });
}

module.exports = { run };
