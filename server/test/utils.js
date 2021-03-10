const path = require('path');
const { expect } = require('chai');
const sinon = require('sinon');

const { DocumentURI } = require('../utils');

describe('DocumentURI (win32)', () => {
  let stubs = [];

  beforeEach(() => {
    stubs.push(sinon.stub(process, 'platform').value('win32'));
    stubs.push(sinon.stub(path, 'posix').value({ sep: '/' }));
    stubs.push(sinon.stub(path, 'sep').value('\\'));
  });

  it('should create from path', () => {
    const duri = DocumentURI.createFromPath('\\c\\Program Files\\folder\\file.txt');

    // TODO: не должен тут path совпадать с uri по формату?
    expect(duri.path).eql('\\c\\Program Files\\folder\\file.txt');

    // TODO: точно тут должно быть четыре слэша после file?
    expect(duri.uri).eql('file:////c/Program%20Files/folder/file.txt');

    // TODO: почему не 'file'?
    expect(duri.protocol).eql(null);
  });

  it('should create from uri', () => {
    const duri = DocumentURI.createFromURI('file:///c/Program%20Files/folder/file.txt');

    // TODO: почему без ведущего слэша?
    expect(duri.path).eql('c/Program Files/folder/file.txt');

    expect(duri.uri).eql('file:///c/Program%20Files/folder/file.txt');

    // TODO: даже тут null!
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

    // TODO: почему не 'file'?
    expect(duri.protocol).eql(null);
  });

  it('should create from uri', () => {
    const duri = DocumentURI.createFromURI('file:///home/user/file.txt');

    expect(duri.path).eql('/home/user/file.txt');
    expect(duri.uri).eql('file:///home/user/file.txt');

    // TODO: даже тут null!
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
