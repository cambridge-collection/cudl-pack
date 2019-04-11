import compiler from './compiler';
// import test from "jest"

test('foo', () => {
    expect('a').toBe('a');
})

test('Hello world loader test', async () => {
    const stats = await compiler('data/site.xml');
    const output = stats.toJson().modules[0].source;

    expect(eval(output)).toEqual({foo: 123});
});
