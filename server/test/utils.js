const path = require('path');
const { expect } = require('chai');
const sinon = require('sinon');

const {
  get,
  DocumentURI,
} = require('../utils');

describe('get', () => {
  it('should return value when it exists', () => {
    const obj = {
      a: {
        b: {
          c: 1,
        },
      },
    };

    expect(get('a', 'b', 'c').from(obj)).eql(1);
  });

  it('should return null when value does not exist', () => {
    const obj = {
      a: {
        b: {
          c: 1,
        },
      },
    };

    expect(get('a', 'b', 'd').from(obj)).eql(null);
  });
});

describe('DocumentURI (win32)', () => {
  let stubs = [];

  beforeEach(() => {
    stubs.push(sinon.stub(process, 'platform').value('win32'));
    stubs.push(sinon.stub(path, 'posix').value({ sep: '/' }));
    stubs.push(sinon.stub(path, 'sep').value('\\'));
  });

  it('should create from path', () => {
    const duri = DocumentURI.createFromPath('\\c:Program Files\\folder\\file.txt');

    // TODO: shouldn't the path format be the same as uri here?
    expect(duri.path).eql('\\c:Program Files\\folder\\file.txt');

    // TODO: four slashes after "file" look suspicious, is it right?
    expect(duri.uri).eql('file:////c%3AProgram%20Files/folder/file.txt');

    // TODO: why not 'file'?
    expect(duri.protocol).eql(null);
  });

  it('should create from uri', () => {
    const duri = DocumentURI.createFromURI('file:///c%3AProgram%20Files/folder/file.txt');

    // TODO: why no leading slash?
    expect(duri.path).eql('c:Program Files/folder/file.txt');

    expect(duri.uri).eql('file:///c%3AProgram%20Files/folder/file.txt');

    // TODO: even here is null!
    expect(duri.protocol).eql(null);
  });

  it('should not create from uri when protocol is not `file`', () => {
    const duri = DocumentURI.createFromURI('https://funbox.ru');

    expect(duri).eql(null);
  });

  afterEach(() => {
    stubs.forEach(s => s.restore());
    stubs = [];
  });
});

describe('DocumentURI (linux)', () => {
  let stubs = [];

  beforeEach(() => {
    stubs.push(sinon.stub(process, 'platform').value('linux'));
    stubs.push(sinon.stub(path, 'posix').value({ sep: '/' }));
    stubs.push(sinon.stub(path, 'sep').value('/'));
  });

  it('should create from path', () => {
    const duri = DocumentURI.createFromPath('/home/user/file.txt');

    expect(duri.path).eql('/home/user/file.txt');
    expect(duri.uri).eql('file:///home/user/file.txt');

    // TODO: why not 'file'?
    expect(duri.protocol).eql(null);
  });

  it('should create from uri', () => {
    const duri = DocumentURI.createFromURI('file:///home/user/file.txt');

    expect(duri.path).eql('/home/user/file.txt');
    expect(duri.uri).eql('file:///home/user/file.txt');

    // TODO: even here is null!
    expect(duri.protocol).eql(null);
  });

  it('should not create from uri when protocol is not `file`', () => {
    const duri = DocumentURI.createFromURI('https://funbox.ru');

    expect(duri).eql(null);
  });

  afterEach(() => {
    stubs.forEach(s => s.restore());
    stubs = [];
  });
});
