import jsonpatch from 'fast-json-patch';
import _fileUrl from 'file-url';
import fs from 'fs';
import json5 from 'json5';
import {join, resolve} from 'path';
import url from 'url';
import {promisify} from 'util';

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

function schemaPackagePath(path: string) {
    return join('cudl-schema-package-json', path);
}

export function getSchemaData(): Schemas {
    const files = require('cudl-schema-package-json').files as string[];

    const schemas = files.filter((f) => /^schemas\//.test(f))
        .map((f) => {
            const match = /^schemas\/([^/]+)\.json5?$/.exec(f);
            return {name: match[1], schemaPath: match[0]};
        });

    const data: Schemas = {};
    for(const schema of schemas) {
        const name = schema.name;
        data[name] = {
            schema: schemaPackagePath(schema.schemaPath),
            validTestCases: files.filter((f) => f.startsWith(`tests/${name}/valid/`))
                .map(schemaPackagePath),
            invalidTestCases: files.filter((f) => f.startsWith(`tests/${name}/invalid/`))
                .map(schemaPackagePath),
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
        errorMatchers: string | string[] | ErrorMessageMatcher | ErrorMessageMatcher[]) {

        let matchers: Array<string | ErrorMessageMatcher>;
        if(typeof errorMatchers === 'string' || typeof errorMatchers === 'object') {
            matchers = [errorMatchers as (string | ErrorMessageMatcher)];
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
    public readonly patch: jsonpatch.Operation[];
    public readonly errorMatchers: ErrorMessageMatcher[];

    constructor(testcasePath: string, baseJSONPath: string, patch: jsonpatch.Operation[],
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
            .then((baseJSON) => jsonpatch.applyPatch(baseJSON, this.patch).newDocument);
    }
}

interface NegativeSchemaTestcaseJSON {
    base: string;
    patch: jsonpatch.Operation[];
    expectedErrors?: string | string[] | ErrorMessageMatcher | ErrorMessageMatcher[];
}

type ErrorMessageMatcher = SubstringErrorMessageMatcher | ExactErrorMessageMatcher | RegexErrorMessageMatcher;
interface RegexErrorMessageMatcher { regex: string; }
interface ExactErrorMessageMatcher { exact: string; }
interface SubstringErrorMessageMatcher { contains: string; }
