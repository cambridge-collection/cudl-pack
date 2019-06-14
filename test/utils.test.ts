import {enumMemberGuard, enumMembers, sortKeyTupleFuncToScalarFuncs} from '../src/utils';

test('sortKeyTupleFuncToScalarFuncs',  () => {
    function key(val: [string, number]) { return [val[1], val[0]]; }

    const [a, b] = sortKeyTupleFuncToScalarFuncs(key, 2);
    expect(a(['foo', 42])).toEqual(42);
    expect(b(['foo', 42])).toEqual('foo');
});

test('enumMembers', () => {
    enum Foo {a, b, c}
    const members = enumMembers(Foo);
    expect(members).toEqual(new Set(['a', 'b', 'c']));

    const [member] = members.values();
    // typescript knows member is a key of Foo
    expect(typeof Foo[member]).toBe('number');
});

test('isEnumMemberGuard', () => {
    enum Foo {a, b, c}
    const isAFoo = enumMemberGuard(Foo);

    const key = 'a' as string;

    // typescript won't let us index Foo with a string:
    // expect(typeof Foo[key]).toBe('number');

    if(isAFoo(key)) {
        // ... unless we prove it's a key of Foo
        expect(typeof Foo[key]).toBe('number');
    }
    expect.assertions(1);
});
