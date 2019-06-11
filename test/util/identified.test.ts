import fp from 'lodash/fp';
import {Identified, identify} from '../../src/util/identified';

test('identify() attaches object key to object value as `identifiedID`', () => {
    interface Val { a: number; }
    const values: {[key: string]: Val} = {foo: {a: 1}, bar: {a: 2}};
    const identifiedValues: Array<Identified<Val>> = identify(values);

    expect(fp.sortBy([(x) => x.a], identifiedValues)).toEqual([
        {[identify.id]: 'foo', a: 1},
        {[identify.id]: 'bar', a: 2},
    ]);
});
