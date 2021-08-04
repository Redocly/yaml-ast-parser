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
    assert.lengthOf(doc.errors, 1, `Found error(s): ${doc.errors.toString()} when expecting none.`)
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

    assert.equal(doc.endPosition, input.length);
    assert.equal(doc.mappings[0].startPosition, 0);
    assert.equal(doc.mappings[0].endPosition, 15);

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
    console.log(doc)

    assert.equal(doc.endPosition, input.length);
    assert.isTrue(doc.mappings[0].endPosition < doc.mappings[1].startPosition);

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
