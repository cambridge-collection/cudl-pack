import jsonpatch from 'fast-json-patch';
import fileUrl from 'file-url';
import fs from 'fs';
import json5 from 'json5';
import {join} from 'path';
import url from 'url';
import {promisify} from 'util';

export function dirUrl(dirPath: string) {
    const u = new url.URL(fileUrl(dirPath, {resolve: false}));
    if(!u.pathname.endsWith('/')) {
        u.pathname = u.pathname + '/';
    }
    return u.toString();
}

export function resolve(start: string, ...urls: string[]) {
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
    public static allFromDir(dir: string): Promise<NegativeSchemaTestCase[]> {
        return promisify(fs.readdir)(dir)
            .then((names: string[]) => {
                const paths = names.map((n) => join(dir, n));
                return Promise.all(paths.map(this.fromPath));
            });
    }

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
        const path = url.resolve(this.testcasePath, this.baseJSONPath);
        const json = await promisify(fs.readFile)(path, 'utf-8')
            .then(json5.parse);

        if(typeof json !== 'object') {
            throw new Error(`Expected an object after parsing ${path} but got ${typeof json}`);
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

/*
{
  base: "../valid/minimal.json",
  patch: [
    {op:  "remove", path: "/@type"}
  ],
  expectedErrors: "'@type' is a required property"
}

 */
