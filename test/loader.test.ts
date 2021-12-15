import * as YAML from '../src/'
import { AbstractVisitor } from './visitor'

import * as chai from 'chai'
import { YamlMap, YAMLMapping } from '../src/';
const assert = chai.assert

function structure(node) {
    return new DuplicateStructureBuilder().accept(node);
}

suite('Loading a single document', () => {
    test('should work with document-end delimiters', function () {
        const input = `---
whatever: true
...`
        const doc = YAML.safeLoad(input)
        const expected_structure =
            YAML.newMap(
                [YAML.newMapping(
                    YAML.newScalar('whatever'),
                    YAML.newScalar('true'))]);

        assert.deepEqual(structure(doc), expected_structure)

        assert.lengthOf(doc.errors, 0,
            `Found error(s): ${doc.errors.toString()} when expecting none.`)
    });

    test('Document end position should be equal to input length', function () {
        const input = `
outer:
inner:
    `;
        const doc1 = YAML.load(input);
        assert.deepEqual(doc1.endPosition,input.length);
    });
});

suite('Fault toleracy', () => {
  test('should work with invalid multi-line key', function () {
    const input = `whatever: true
test
foo: bar`;
    const doc = YAML.safeLoad(input) as YamlMap;
    assert.lengthOf(doc.mappings, 3);
    assert.equal((doc.mappings[1] as YAMLMapping).value, null);
    assert.deepEqual(
      {
        ...(doc.mappings[1] as YAMLMapping).key,
        parent: null,
      },
      {
        doubleQuoted: false,
        endPosition: 19,
        errors: [],
        kind: 0,
        nodeIndent: 0,
        parent: null,
        plainScalar: true,
        rawValue: 'test',
        startPosition: 15,
        value: 'test',
      }
    );
    assert.lengthOf(doc.errors, 1, `Found error(s): ${doc.errors.toString()} when expecting none.`);
  });

  test('should work with invalid multi-line key in sequence', function () {
    const input = `tags:
  - email
  n `;
    const doc = YAML.safeLoad(input) as YamlMap;

    const seq = YAML.newSeq();
    seq.items = [YAML.newScalar('email')];
    assert.lengthOf(doc.mappings, 1);
    const expected_structure =
            YAML.newMap(
                [YAML.newMapping(
                    YAML.newScalar('tags'),
                    seq)]);
    assert.deepEqual(structure(doc), expected_structure)
    assert.lengthOf(doc.errors, 2, `Found error(s): ${doc.errors.toString()} when expecting none.`)
  });

  test('should not contain spaces', function () {
    const input = `tags:
  - email
  
 
 
 
  `;
    const doc = YAML.safeLoad(input) as YamlMap;

    const seq = YAML.newSeq();
    seq.items = [YAML.newScalar('email')];
    assert.lengthOf(doc.mappings, 1);
    const expected_structure =
            YAML.newMap(
                [YAML.newMapping(
                    YAML.newScalar('tags'),
                    seq)]);

    const docSeq = <YAML.YAMLSequence>doc.mappings[0].value;
    
    assert.equal(doc.endPosition, input.length);
    assert.equal(doc.mappings[0].startPosition, 0);
    assert.equal(docSeq.items[0].endPosition, input.length);
    assert.equal(docSeq.endPosition, input.length);
    assert.equal(doc.mappings[0].endPosition, input.length);

    assert.deepEqual(structure(doc), expected_structure)
    assert.lengthOf(doc.errors, 0)
  });

  test('should not contain spaces between items', function () {
    const input = `tags:
  - email
 
 
newTags:
  - user
  `;
    const doc = YAML.safeLoad(input) as YamlMap;

    assert.equal(doc.endPosition, input.length);
    assert.isTrue(doc.mappings[0].endPosition < doc.mappings[1].startPosition);

    assert.lengthOf(doc.errors, 0)
  });

  test('should contain spaces between items', function () {
    const seq = `tags:
  - email
  `;
    const mapping = `
newTags:
  whatever: false
  `;
    const input = seq + mapping;
    const doc = YAML.safeLoad(input) as YamlMap;

    assert.equal(doc.endPosition, input.length);
    assert.equal(doc.mappings[0].endPosition, seq.length);
    assert.equal(doc.mappings[1].endPosition, input.length);
    assert.isTrue(doc.mappings[0].endPosition < doc.mappings[1].startPosition);
    
    assert.lengthOf(doc.errors, 0);
  });

  test('mapping values must end 1 character before next mapping starts', () => {
    const input = `
openapi: 3.1.0
servers: 
  - url:  anything
    description: some description
  - url: //petstore.swagger.io/sandbox
    description: Sandbox server
    variables: 
      varName: default
`;
    const doc = YAML.safeLoad(input) as YamlMap;
    const [openApiMapping, serversMapping] = doc.mappings;
    const docSeq = <YAML.YAMLSequence>doc.mappings[1].value;
    const [firstMap, secondMap] = <YAML.YamlMap[]>docSeq.items;
    
    assert.equal(doc.endPosition, input.length);
    
    assert.equal(openApiMapping.startPosition, 1);
    assert.equal(openApiMapping.endPosition, 15);

    assert.equal(serversMapping.startPosition, 16);
    assert.equal(serversMapping.endPosition, input.length - 1);

    assert.equal(firstMap.mappings[0].endPosition, 48);
    assert.equal(firstMap.mappings[1].endPosition, 80);

    assert.equal(secondMap.mappings[0].endPosition, 121);
    assert.equal(secondMap.mappings[1].endPosition, 153);

    assert.equal(secondMap.mappings[2].startPosition, 154);
    assert.equal(secondMap.mappings[2].endPosition, input.length - 1);

    const variablesMap = <YAML.YamlMap>secondMap.mappings[2].value;

    assert.equal(variablesMap.startPosition, 172);
    assert.equal(variablesMap.mappings[0].startPosition, 172);
    assert.equal(variablesMap.mappings[0].endPosition, input.length - 1);
  });

  test('mapping with multiline value must end at the end of document', () => {
    const input = `
mapping: |
  some 
  multiline value
  ends
  here`;

    const doc = YAML.safeLoad(input) as YamlMap;
    const [mapping] = doc.mappings;

    assert.equal(mapping.endPosition, input.length);
    assert.equal(mapping.value.endPosition, input.length);
  });

  test('every scalar value in sequence must end 1 character before next sequence item starts', () => {
    const input = `
enum:
  - clueless
  - lazy
  - adventurous
  - aggressive
  - |
    multiline
    string
    should work
`;
        const doc = YAML.safeLoad(input) as YamlMap;
        const [enumMapping] = doc.mappings;
        const enumSeq = <YAML.YAMLSequence>enumMapping.value;
        const [clueless, lazy, adventurous, aggressive, multiline] = <YAML.YamlMap[]>enumSeq.items;
        
        assert.equal(doc.endPosition, input.length);
        
        assert.equal(clueless.startPosition, 11);
        assert.equal(clueless.endPosition, 21);
    
        assert.equal(lazy.startPosition, 24);
        assert.equal(lazy.endPosition, 30);
    
        assert.equal(adventurous.startPosition, 33);
        assert.equal(adventurous.endPosition, 46);
    
        assert.equal(aggressive.startPosition, 49);
        assert.equal(aggressive.endPosition, 61);

        assert.equal(multiline.startPosition, 64);
        assert.equal(multiline.endPosition, 106);
  });

  test('empty mapping value should end where next mapping starts', () => {
    const input = `
openapi: 3.1.0
servers: 
  - url:     
    description: some description
`;

    const doc = YAML.safeLoad(input) as YamlMap;
    const [, serversMapping] = doc.mappings;
    const docSeq = <YAML.YAMLSequence>doc.mappings[1].value;
    const [firstMap] = <YAML.YamlMap[]>docSeq.items;
    
    assert.equal(doc.endPosition, input.length);
    
    assert.equal(serversMapping.endPosition, input.length - 1);
    
    assert.equal(firstMap.mappings[0].startPosition, 30);
    assert.equal(firstMap.mappings[0].endPosition, 43);
    
    assert.equal(firstMap.mappings[1].startPosition, 44);
    assert.equal(firstMap.mappings[1].endPosition, 73);

    assert.lengthOf(doc.errors, 0)
  });
});

suite('Loading multiple documents', () => {
    test('should work with document-end delimiters', function () {
        const docs = []
        YAML.loadAll(`---
whatever: true
...
---
whatever: false
...`, d => docs.push(d))

        const expected_structure = [
            YAML.newMap(
                [YAML.newMapping(
                    YAML.newScalar('whatever'),
                    YAML.newScalar('true'))]),
            YAML.newMap(
                [YAML.newMapping(
                    YAML.newScalar('whatever'),
                    YAML.newScalar('false'))])
        ];

        assert.deepEqual(docs.map(d => structure(d)), expected_structure)

        docs.forEach(doc =>
            assert.lengthOf(doc.errors, 0,
                `Found error(s): ${doc.errors.toString()} when expecting none.`))
    });

    test('Last document end position should be equal to input length', function () {
        const input = `
outer1:
inner1:
...
---
outer2:
inner2:
    `;
        const documents: YAML.YAMLDocument[] = [];
        YAML.loadAll(input,x=>documents.push(x));
        const doc2 = documents[1];
        assert.deepEqual(doc2.endPosition,input.length);
    });
});

class DuplicateStructureBuilder extends AbstractVisitor {
    visitScalar(node: YAML.YAMLScalar) {
        return YAML.newScalar(node.value)
    }
    visitMapping(node: YAML.YAMLMapping) {
        return YAML.newMapping(this.visitScalar(<YAML.YAMLScalar>node.key), this.accept(node.value))
    }
    visitSequence(node: YAML.YAMLSequence) {
        const seq = YAML.newSeq()
        seq.items = node.items.map(n => this.accept(n))
        return seq
    }
    visitMap(node: YAML.YamlMap) {
        return YAML.newMap(node.mappings.map(n => this.accept(n)));
    }
    visitAnchorRef(node: YAML.YAMLAnchorReference) {
        throw new Error("Method not implemented.");
    }
    visitIncludeRef(node: YAML.YAMLNode) {
        throw new Error("Method not implemented.");
    }
}
