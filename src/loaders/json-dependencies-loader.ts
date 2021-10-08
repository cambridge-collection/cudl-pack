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
import * as tapable from 'tapable';
import * as util from 'util';
import webpack from 'webpack';
import webpackLog from 'webpack-log';
import {createValidator} from '../schemas';

import {AsyncLoadFunction, createAsyncLoader} from '../utils';
import optionsSchemaJSON from './json-dependencies-loader-options.schema.json';

const log = webpackLog({name: 'cudl-pack/loaders/json-dependencies-loader', unique: false});

export interface Reference {
    request: string;
}

export interface ResolvedReference extends Reference {
    resolvedRequest: LoadedModule;
}

export interface IgnoredReference extends Reference {
    resolvedRequest: IgnoredModule;
}

function isIgnoredReference(ref: Reference): ref is IgnoredReference {
    return (ref as any).resolvedRequest instanceof IgnoredModule;
}

export interface LoadedReference extends ResolvedReference {
    loadedRequest: any;
}

export interface HandleReferenceResult {
    doc: any;
    docChanged: boolean;
}

export class DependencyResolutionHooks {
    /** Parse the incoming JSON document. */
    public readonly load = new tapable.AsyncSeriesBailHook<string, webpack.loader.LoaderContext, string, any>(
        ['source', 'context', 'request']);

    public readonly findReferences = new tapable.AsyncSeriesWaterfallHook<
        Reference[], any, webpack.loader.LoaderContext>(['references', 'doc', 'context']);

    public readonly resolveReference = new tapable.AsyncSeriesBailHook<Reference, any,
        webpack.loader.LoaderContext, ResolvedReference | IgnoredReference>(
        ['reference', 'doc', 'context']);

    public readonly handleIgnoredModule = new tapable.AsyncParallelHook<
        IgnoredReference, any, webpack.loader.LoaderContext>(['ignored', 'doc', 'context']);

    public readonly handleReference = new tapable.SyncWaterfallHook<HandleReferenceResult,
        {reference: LoadedReference, doc: any, context: webpack.loader.LoaderContext}>(['result', 'options']);

    public readonly dump =
        new tapable.AsyncSeriesBailHook<HandleReferenceResult, webpack.loader.LoaderContext, string, string>(
            ['result', 'context', 'source']);
}

export type PluginFunction = (hooks: DependencyResolutionHooks) => void;
export interface PluginObject { apply: PluginFunction; }
type Plugin = PluginFunction | PluginObject;

/** Implements baseline loader functionality. */
export class DefaultsPlugin implements PluginObject {
    public static readonly TAP_NAME = 'DefaultsPlugin';
    public static readonly TAP_STAGE = 100;

    public apply(hooks: DependencyResolutionHooks): void {
        // Hack: type definitions for tapable only allow string values for the first argument to .tap(), but tapable
        // actually accepts an options object to configure the tap.
        const optionsHack = {
            name: DefaultsPlugin.TAP_NAME,
            // Tap with a higher stage than the default (0) so that anyone tapping hooks will get their version run
            // first by default.
            stage: DefaultsPlugin.TAP_STAGE,
        } as unknown as string;

        hooks.load.tap(optionsHack, (source, context, request) => {
            try {
                return parseJson(source);
            }
            catch(e) {
                const type = request === context.request ? 'main' : 'referenced';
                throw new Error(`Unable to parse ${type} module as JSON. request: ${request}, parse error: ${e}`);
            }
        });
        hooks.resolveReference.tapPromise(optionsHack, async (reference, doc, context) => {
            try {
                const module = await loadModule(context, reference.request);
                return {...reference, resolvedRequest: module};
            }
            catch(e) {
                if(e instanceof IgnoredModule) {
                    return {...reference, resolvedRequest: e};
                }
                throw new Error(`Unable to load module referenced by: ${reference.request} : ${e}`);
            }
        });
        hooks.handleIgnoredModule.tap(optionsHack, (ignored, doc, context) => {
            log.debug(`Ignored module referenced by ${context.resourcePath}: ${ignored.request}`);
        });
        hooks.dump.tap(optionsHack,
            (result, context, source) => result.docChanged ? JSON.stringify(result.doc) : source);
    }
}

type PathComponent = string | number;
type Path = PathComponent[];

/**
 * A point in a JSON tree that is to be substituted with the result of resolving a module reference.
 */
interface AncestorSubstitutionReference extends Reference {
    substitutionPoint: Path;
}

function isAncestorSubstitutionReference(ref: Reference): ref is AncestorSubstitutionReference {
    if(Array.isArray((ref as any).substitutionPoint)) {
        return (ref as any).substitutionPoint.every((x: any) => typeof x === 'string' || typeof x === 'number');
    }
    return false;
}

export interface JSONPathReferenceSelector {
    expression: string;
    substitutionLevel: number;
}

export type AncestorSubstitutionReferenceSelector = (options: {context: webpack.loader.LoaderContext, json: any})
    => AncestorSubstitutionReference[];

/** Implements the options.references behaviour. */
class ReferenceSelectorPlugin implements PluginObject {
    private readonly refSelector: AncestorSubstitutionReferenceSelector;

    constructor(refSelector: AncestorSubstitutionReferenceSelector) {
        this.refSelector = refSelector;
    }

    public apply(hooks: DependencyResolutionHooks): void {
        hooks.findReferences.tap('ReferenceSelectorPlugin', (references, json, context) => {
            return references.concat(this.refSelector({context, json}));
        });
        hooks.handleReference.tap('ReferenceSelectorPlugin', (result, {reference, doc, context}) => {
            if(!isAncestorSubstitutionReference(reference)) {
                return result;
            }

            const newResult = insertReference(doc, reference, context);
            return {doc: newResult.doc, docChanged: result.docChanged || newResult.docChanged};
        });
    }
}

interface Node {
    path: jsonpath.PathComponent[];
    value: any;
}

interface ReferenceNode extends Node, JSONPathReferenceSelector { }

export function selectReferencesWithJSONPath(
    context: webpack.loader.LoaderContext, selectors: JSONPathReferenceSelector[], json: any,
): AncestorSubstitutionReference[] {
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

    return referenceNodes.map((node) => ({
        substitutionPoint: node.path,
        request: urlToRequest(node.value),
    }));
}

function insertReference(jsonRoot: any, ref: LoadedReference & AncestorSubstitutionReference,
                         context: webpack.loader.LoaderContext): HandleReferenceResult {
    if(ref.substitutionPoint.length === 0) {
        // We're replacing the root value
        return {doc: ref.loadedRequest, docChanged: true};
    }
    else {
        const [parentPath, leafAttr] = [
            ref.substitutionPoint.slice(0, -1), ref.substitutionPoint[ref.substitutionPoint.length - 1]];
        const parent = parentPath.length === 0 ? jsonRoot : fp.get(parentPath)(jsonRoot);

        if(parent === undefined) {
            context.emitWarning( `\
Substitution point ${util.inspect(ref.substitutionPoint)} for reference to ${util.inspect(ref.request)} does not \
exist`);
            return {doc: jsonRoot, docChanged: false};
        }

        // Could have some kind of merge function here to combine the existing value with the merged value.
        // However I think the right thing to do is to implement an actual JSON-LD module type which can
        // natively represent references, rather than trying to enhance this workaround for baseline JSON
        // modules.
        parent[leafAttr] = ref.loadedRequest;
        return {doc: jsonRoot, docChanged: true};
    }
}

interface WebpackModule extends webpack.Module {
    type: string;
}

export interface LoadedModule {
    source?: string;
    sourceMap?: RawSourceMap;
    module?: WebpackModule;
}

export class IgnoredModule extends Error {}

function loadModule(loaderContext: webpack.loader.LoaderContext, request: string): Promise<LoadedModule> {
    return new Promise((resolve, reject) => {
        loaderContext.loadModule(request, (err, source, sourceMap, module: WebpackModule) => {
            if(err) {
                // Webpack allows modules to be ignored, e.g. via the NormalModuleFactory beforeResolve hook.
                // However the LoaderContext.loadModule() method doesn't handle ignored modules, and fails with the
                // following error if it gets no module from its load request.
                if(err.message === 'Cannot load the module') {
                    reject(new IgnoredModule(`${request} is an ignored module`));
                }
                reject(err);
            }
            else { resolve({source, sourceMap, module}); }
        });
    });
}

interface Options {
    references?: string | string[] | JSONPathReferenceSelector | JSONPathReferenceSelector[] |
        AncestorSubstitutionReferenceSelector;
    plugins?: Plugin[];
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

function pluginAsFunction(plugin: Plugin): PluginFunction {
    return typeof plugin === 'function' ? plugin : plugin.apply.bind(plugin);
}

function getPlugins(options: Options): PluginFunction[] {
    const plugins = [pluginAsFunction(new DefaultsPlugin())];

    if(options.references !== undefined || options.plugins === undefined) {
        let referenceSelector: AncestorSubstitutionReferenceSelector;
        if(typeof options.references === 'function')
            referenceSelector = options.references;
        else {
            const jsonpathSelectors: JSONPathReferenceSelector[] = (
                Array.isArray(options.references) ?
                    options.references : [options.references || defaultReferenceSelector])
                .map(ref => {
                    if(typeof ref === 'string')
                        return {expression: ref, substitutionLevel: 0};
                    else
                        return ref;
                });
            referenceSelector = ({context, json}) => selectReferencesWithJSONPath(context, jsonpathSelectors, json);
        }
        plugins.push(pluginAsFunction(new ReferenceSelectorPlugin(referenceSelector)));
    }

    plugins.push(...(options.plugins || []).map(pluginAsFunction));
    return plugins;
}

const loader: AsyncLoadFunction = (async function(this: webpack.loader.LoaderContext, source: string): Promise<string> {
    const options = validateOptions(clone(loaderUtils.getOptions(this) || {}));
    const plugins = getPlugins(options);

    const hooks = new DependencyResolutionHooks();
    plugins.forEach(p => p(hooks));

    const json = await hooks.load.promise(source, this, this.request);
    let result: HandleReferenceResult = {doc: json, docChanged: false};
    const references: Reference[] = await hooks.findReferences.promise([], json, this);
    for(const ref of references) {
        const resolvedRef = await hooks.resolveReference.promise(ref, json, this);
        if(resolvedRef === undefined) {
            throw new Error(`${ref.request} was not resolved`);
        }

        if(isIgnoredReference(resolvedRef)) {
            hooks.handleIgnoredModule.promise(resolvedRef, json, this);
            continue;
        }

        const loadedReference: LoadedReference = {
            ...resolvedRef,
            loadedRequest: await hooks.load.promise(resolvedRef.resolvedRequest.source, this,
                                                      resolvedRef.request),
        };
        result = await hooks.handleReference.promise(
            result, {reference: loadedReference, doc: json, context: this});
    }

    const output = await hooks.dump.promise(result, this, source);
    if(output === undefined) {
        throw new Error('dump hook produced no output');
    }
    return output;
});

export default createAsyncLoader(loader);
export {
    Options as JSONDependenciesLoaderOptions,
};
