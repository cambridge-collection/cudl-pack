import {applyPatch, Operation} from 'fast-json-patch';
import _fileUrl from 'file-url';
import fs from 'fs';
import json5 from 'json5';
import {join, resolve} from 'path';
import url from 'url';
import util from 'util';
import {promisify} from 'util';
import webpack, { Stats } from 'webpack';
import {isNotUndefined} from '../src/utils';

/**
 * Return the contents of a file as bytes.
 * @param pathSegments relative or absolute paths to resolve against the test dir
 */
export async function readPath(...pathSegments: string[]): Promise<Buffer> {
    return (await promisify(fs.readFile)(resolve(__dirname, ...pathSegments)));
}

/**
 * Return the contents of a file as as a string.
 *
 * The file is assumed to contain UTF-8-encoded text.
 *
 * @param pathSegments relative or absolute paths to resolve against the test dir
 */
export async function readPathAsString(...pathSegments: string[]): Promise<string> {
    return (await readPath(...pathSegments)).toString();
}

export function fileUrl(path: string) {
    const u = new url.URL(_fileUrl(path, {resolve: false}));
    // Preserve trailing slashes as they're significant for URL resolution
    if(path.endsWith('/')) {
        u.pathname = u.pathname + '/';
    }
    return u.toString();
}

export function resolveUrls(start: string, ...urls: string[]) {
    return urls.reduce((base, next) => url.resolve(base, next), start);
}

interface Schemas {
    [key: string]: SchemaResources;
}
interface SchemaResources {
    schema: string;
    validTestCases: string[];
    invalidTestCases: string[];
}

function schemaPackagePath(packageName: string, path: string) {
    return join(packageName, path);
}

/**
 * Load the schemas and test data from one of our schema packages.
 *
 * @param packageName The name of the NPM package, e.g. `cudl-schema-package-json`
 */
export function getSchemaData(packageName: string): Schemas {
    const packagePath = schemaPackagePath.bind(undefined, packageName);
    const files = require(packageName).files as string[];

    const schemas = files.filter((f) => /^schemas\//.test(f))
        .map((f) => {
            const match = /^schemas\/([^/]+)\.json5?$/.exec(f);
            return match ? {name: match[1], schemaPath: match[0]} : undefined;
        });

    const data: Schemas = {};
    for(const schema of schemas) {
        if(schema === undefined) { continue; }
        const name = schema.name;
        data[name] = {
            schema: packagePath(schema.schemaPath),
            validTestCases: files.filter((f) => f.startsWith(`tests/${name}/valid/`)).map(packagePath),
            invalidTestCases: files.filter((f) => f.startsWith(`tests/${name}/invalid/`)).map(packagePath),
        };
    }
    return data;
}

export class NegativeSchemaTestCase {
    public static fromPath(path: string): Promise<NegativeSchemaTestCase> {
        return promisify(fs.readFile)(path, 'utf-8')
            .then(json5.parse)
            .then((testcase: NegativeSchemaTestcaseJSON) => {
                return new NegativeSchemaTestCase(path, testcase.base, testcase.patch,
                    NegativeSchemaTestCase.normaliseErrorMatchers(testcase.expectedErrors));
            });
    }

    private static normaliseErrorMatchers(
        errorMatchers?: string | string[] | ErrorMessageMatcher | ErrorMessageMatcher[]) {

        let matchers: Array<string | ErrorMessageMatcher>;
        if(typeof errorMatchers === 'string' || typeof errorMatchers === 'object') {
            matchers = [errorMatchers as (string | ErrorMessageMatcher)];
        }
        else if(errorMatchers === undefined) {
            matchers = [];
        }
        else {
            matchers = errorMatchers;
        }

        return matchers.map((em) => {
            if(typeof em === 'string') {
                return {contains: em};
            }
            return em;
        });
    }

    public readonly testcasePath: string;
    public readonly baseJSONPath: string;
    public readonly patch: Operation[];
    public readonly errorMatchers: ErrorMessageMatcher[];

    constructor(testcasePath: string, baseJSONPath: string, patch: Operation[],
                errorMatchers: ErrorMessageMatcher[]) {
        this.testcasePath = testcasePath;
        this.baseJSONPath = baseJSONPath;
        this.patch = patch;
        this.errorMatchers = errorMatchers;
    }

    public async readBaseJSON(): Promise<object> {
        const baseLoc = resolveUrls(fileUrl(this.testcasePath), this.baseJSONPath);
        const json = json5.parse(await readPathAsString(url.fileURLToPath(baseLoc)));

        if(typeof json !== 'object') {
            throw new Error(`Expected an object after parsing ${baseLoc} but got ${typeof json}`);
        }
        return json;
    }

    public getPatchedJSON(): Promise<object> {
        return this.readBaseJSON()
            .then((baseJSON) => applyPatch(baseJSON, this.patch).newDocument);
    }
}

interface NegativeSchemaTestcaseJSON {
    base: string;
    patch: Operation[];
    expectedErrors?: string | string[] | ErrorMessageMatcher | ErrorMessageMatcher[];
}

type ErrorMessageMatcher = SubstringErrorMessageMatcher | ExactErrorMessageMatcher | RegexErrorMessageMatcher;
interface RegexErrorMessageMatcher { regex: string; }
interface ExactErrorMessageMatcher { exact: string; }
interface SubstringErrorMessageMatcher { contains: string; }

export function ensure<A, B extends A>(value: A, predicate: (value: A) => value is B): B {
    if(predicate(value)) {
        return value;
    }
    throw new Error(`predicate not satisfied; value: ${util.inspect(value)}`);
}

/**
 * Throw an error if value is undefined, otherwise return it.
 */
export function ensureDefined<A>(value?: A): A {
    return ensure(value, isNotUndefined);
}

type NotUndefined<A> = A extends undefined ? never : A;

type EnsureDefinedWrapper<T> = {
    [P in keyof T]-?:
        NotUndefined<T[P]> extends object ? EnsureDefinedWrapper<T[P]> :
        NotUndefined<T[P]>;
} & {unwrap: () => NotUndefined<T>};

type Property = string | number | symbol;

function renderPath(path: Property[]): string {
    return path.reduce<string>((rendered, p) => rendered + renderPathProperty(p), '');
}

function renderPathProperty(property: Property): string {
    return typeof property === 'string' && /^\w+$/.test(property) ? `.${property}` : `[${String(property)}]`;
}

/**
 * Wrap an object with a proxy which acts like calling ensureDefined() on each
 * property access. i.e. accessing a property with an undefined value will
 * immediately fail, rather than later when something attempts to do something
 * with the undefined value.
 *
 * The returned wrapper has all the properties of the original object, plus an
 * unwrap() method to obtain the unwrapped object. Properties which resolve to
 * non-object values return values directly.
 */
function wrapEnsureDefined<A>(value?: A, path?: Property | Property[]):
    A extends object ? EnsureDefinedWrapper<A> : NotUndefined<A> {

    const _path = Array.isArray(path) ? path : path === undefined ? [] : [path];

    if(value === undefined)
        throw new Error(`value${renderPath(_path)} is undefined`);

    if(value === null ||
        typeof value === 'string' ||
        typeof value === 'boolean' ||
        typeof value === 'number' ||
        typeof value === 'bigint' ||
        typeof value === 'symbol') {
        return value as any;
    }

    return new Proxy(value as any, {
        get(target: object, p: string | number | symbol, receiver: any): any {
            if(p === 'unwrap') {
                return () => value;
            }
            const next = Reflect.get(target, p, receiver);
            if(typeof next === 'function') {
                return next.bind(target);
            }
            return wrapEnsureDefined(next, _path.concat(p));
        },
    }) as any;
}

ensureDefined.wrap = wrapEnsureDefined;

export function getModule(
    modName: string, stats: webpack.Stats, statsOptions?: Parameters<webpack.Stats['toJson']>[0],
): webpack.StatsModule {
    const modules = stats.toJson(statsOptions).modules;
    const mod = stats.toJson(statsOptions).modules?.find(m => m.name === modName);
    if(mod === undefined) {
        const modNames = modules?.map(m => m.name || '** unnamed module **').join(', ');
        throw new Error(`stats contains no module named '${modName}' (Module names: ${modNames})`);
    }
    return mod;
}

export function getModuleSource(modName: string, stats: webpack.Stats): string {
    const src = getModule(modName, stats, {source: true}).source;
    if(src === undefined) {
        throw new Error(`module '${modName}' has no source`);
    }
    return src.toString();
}
