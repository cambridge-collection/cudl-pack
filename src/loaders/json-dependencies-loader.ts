/**
 * A loader which resolves references to other JSON modules and inlines them.
 *
 * This is basically a workaround for not having a proper custom JSON module,
 * with a parser that can find references in the module.
 *
 * The loader finds "@id" keys on objects and treats their value as a module
 * path to resolveUrls. The value of the resolved module replaces the object
 * containing the "@id" key.
 *
 * Because the parent is replaced, "@id" references should only be used in
 * objects in which the reference is the only value.
 */
import Ajv from 'ajv';
import ajvKeywords from 'ajv-keywords';
import assert from 'assert';
import clone from 'clone';
import parseJson from 'json-parse-better-errors';
import jsonpath from 'jsonpath';
import loaderUtils, {urlToRequest} from 'loader-utils';
import fp from 'lodash/fp';
import {RawSourceMap} from 'source-map';
import * as util from 'util';
import webpack from 'webpack';
import webpackLog from 'webpack-log';
import {createValidator} from '../schemas';

import {createAsyncLoaderFromMethod} from '../utils';
import optionsSchemaJSON from './json-dependencies-loader-options.schema.json';

const log = webpackLog({name: 'cudl-pack/loaders/json-dependencies-loader', unique: false});

type PathComponent = string | number;
type Path = PathComponent[];

/**
 * A point in a JSON tree that is to be substituted with the result of resolving a module reference.
 */
interface Reference {
    substitutionPoint: Path;
    reference: string;
}

interface JSONPathReferenceSelector {
    expression: string;
    substitutionLevel: number;
}

export type ReferenceSelector = (options: {context: webpack.loader.LoaderContext, json: any}) => Reference[];

class JsonDependenciesLoader {
    public static matchReferencesFromJSONPath(
        references: string | string[] | JSONPathReferenceSelector | JSONPathReferenceSelector[],
    ): JsonDependenciesLoader {
        const selectors: JSONPathReferenceSelector[] = (Array.isArray(references) ? references : [references])
            .map((ref) => (typeof ref === 'string' ?
                {expression: ref, substitutionLevel: 0} : ref));

        for(const selector of selectors) {
            if(selector.substitutionLevel < 0) {
                throw new Error(`substitutionLevel cannot be negative: ${selector.substitutionLevel}`);
            }
        }

        return new JsonDependenciesLoader((options: {context: webpack.loader.LoaderContext, json: any}) => {
            return selectReferencesWithJSONPath(options.context, selectors, options.json);
        });
    }

    public readonly load: (this: webpack.loader.LoaderContext, source: string) => void;
    private readonly refSelector: ReferenceSelector;

    constructor(refSelector: ReferenceSelector) {
        this.refSelector = refSelector;

        this.load = createAsyncLoaderFromMethod(this._load, this);
    }

    private async _load(context: webpack.loader.LoaderContext, source: string): Promise<string> {
        return load(context, source, this.refSelector);
    }
}

interface Node {
    path: jsonpath.PathComponent[];
    value: any;
}

interface ReferenceNode extends Node, JSONPathReferenceSelector { }

export function selectReferencesWithJSONPath(context: webpack.loader.LoaderContext,
                                             selectors: JSONPathReferenceSelector[], json: any): Reference[] {
    const [referenceNodes, ignoredNodes] = fp.pipe(
        fp.flatMap((selector: JSONPathReferenceSelector): ReferenceNode[] => {
            return fp.map((node: Node) => {
                // JSONPath paths always start with '$', drop that
                let path = node.path.slice(1);
                const end = path.length - selector.substitutionLevel;
                if(end < 0) {
                    throw Error(`\
JSONPath expression matched a reference too close to the document root for the substitutionLevel: \
${selector.substitutionLevel}, matched path:, ${util.inspect(node.path)}, expression: ${selector.expression}`);
                }
                assert(end <= path.length);
                path = path.slice(0, end);

                return {...selector, value: node.value, path};
            })(jsonpath.nodes(json, selector.expression));
        }),
        fp.sortBy((node) => node.path.join('.')),
        fp.partition((node) => typeof node.value === 'string'),
    )(selectors);

    for(const ignoredNode of ignoredNodes) {
        context.emitWarning(`Ignoring non-string reference value at \
${util.inspect(ignoredNode.path)}, selected by ${ignoredNode.expression}: \
${util.inspect(ignoredNode.value)}`);
    }

    return referenceNodes.map((node) => ({substitutionPoint: node.path, reference: node.value}));
}

async function load(
    context: webpack.loader.LoaderContext, source: string, selectReferences: ReferenceSelector,
): Promise<string> {

    let json = parseJson(source);
    const referenceNodes = selectReferences({context, json});

    json = await resolveReferences(context, json, referenceNodes);
    return JSON.stringify(json);
}

async function resolveReferences(
    context: webpack.loader.LoaderContext, json: any, references: Reference[],
): Promise<any> {

    const resolvedReferences = await Promise.all(
        references.map((ref) => resolveReference(context, ref.reference)
            .then((result) => ({...ref, result}))));

    return resolvedReferences.reduce((jsonRoot, ref) => {
        if(ref.result.status === 'ignored') {
            log.debug(`Ignored module referenced by ${context.resourcePath}: ${ref.reference}`);
            return jsonRoot;
        }

        if(ref.substitutionPoint.length === 0) {
            // We're replacing the root value
            return ref.result.value;
        }
        else {
            const [parentPath, leafAttr] = [
                ref.substitutionPoint.slice(0, -1), ref.substitutionPoint[ref.substitutionPoint.length - 1]];
            const parent = parentPath.length === 0 ? jsonRoot : fp.get(parentPath)(jsonRoot);

            if(parent === undefined) {
                context.emitWarning(`\
Substitution point ${util.inspect(ref.substitutionPoint)} for reference to ${util.inspect(ref.reference)} does not \
exist`);
                return jsonRoot;
            }

            // Could have some kind of merge function here to combine the existing value with the merged value.
            // However I think the right thing to do is to implement an actual JSON-LD module type which can
            // natively represent references, rather than trying to enhance this workaround for baseline JSON
            // modules.
            parent[leafAttr] = ref.result.value;
            return jsonRoot;
        }
    }, json);
}

interface IgnoredResolveResult {
    status: 'ignored';
}
interface SuccessfulResolveResult {
    status: 'resolved';
    value: any;
}
type ResolveResult = IgnoredResolveResult | SuccessfulResolveResult;

async function resolveReference(context: webpack.loader.LoaderContext, reference: string): Promise<ResolveResult> {
    const request = urlToRequest(reference, context.rootContext);

    let result;
    try { result = await loadModule(context, request); }
    catch (e) {
        throw new Error(`Unable to load module referenced by: ${util.inspect(reference)}: ${e}`);
    }

    const {source, module} = result;
    if(!source || !module)
        return {status: 'ignored'};

    try {
        return {status: 'resolved', value: parseJson(source)};
    }
    catch(e) {
        throw new Error(`\
Unable to parse referenced module as JSON. module type: ${module.type}, \
reference: ${util.inspect(reference)}, parse error: ${e}`);
    }
}

interface WebpackModule extends webpack.Module {
    type: string;
}

interface LoadedModule {
    source?: string;
    sourceMap?: RawSourceMap;
    module?: WebpackModule;
}

function loadModule(loaderContext: webpack.loader.LoaderContext, request: string): Promise<LoadedModule> {
    return new Promise((resolve, reject) => {
        loaderContext.loadModule(request, (err, source, sourceMap, module: WebpackModule) => {
            if(err) {
                // Webpack allows modules to be ignored, e.g. via the NormalModuleFactory beforeResolve hook.
                // However the LoaderContext.loadModule() method doesn't handle ignored modules, and fails with the
                // following error if it gets no module from its load request.
                if(err.message === 'Cannot load the module') {
                    resolve({});
                    return;
                }
                reject(err);
            }
            else { resolve({source, sourceMap, module}); }
        });
    });
}

interface Options {
    references?: string | string[] | JSONPathReferenceSelector | JSONPathReferenceSelector[] | ReferenceSelector;
}

const ajv = new Ajv();
ajvKeywords(ajv, 'typeof');

const validateOptions = createValidator<Options>({
    schemaId: 'cudl-pack/loaders/json-dependencies-loader-options.schema.json',
    validate: ajv.compile(optionsSchemaJSON),
    name: 'options',
});

const defaultReferenceSelector: JSONPathReferenceSelector = {
    expression: '$..["@id"]',
    substitutionLevel: 1,
};

const loader: webpack.loader.Loader = function(this: webpack.loader.LoaderContext, source: string | Buffer): void {
    const options = validateOptions(clone(loaderUtils.getOptions(this) || {}));

    let referenceSelector: ReferenceSelector;
    if(typeof options.references === 'function')
        referenceSelector = options.references;
    else {
        const jsonpathSelectors: JSONPathReferenceSelector[] =
            (Array.isArray(options.references) ? options.references : [options.references || defaultReferenceSelector])
            .map(ref => {
                if(typeof ref === 'string')
                    return {expression: ref, substitutionLevel: 0};
                else
                    return {substitutionLevel: 0, ...ref};
            });
        referenceSelector = ({context, json}) => selectReferencesWithJSONPath(context, jsonpathSelectors, json);
    }

    new JsonDependenciesLoader(referenceSelector).load.call(this, source);
};

export default loader;
export {
    Options as JSONDependenciesLoaderOptions,
};
