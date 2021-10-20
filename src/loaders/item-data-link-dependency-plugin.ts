import { urlToRequest } from "loader-utils";
import webpack from "webpack";
import { getData, NamespaceLoader } from "../item";
import { isLinkItemData, LinkItemData } from "../item-types";
import { validateItem } from "../schemas";
import {
    DependencyResolutionHooks,
    PluginObject,
    Reference,
} from "./json-dependencies-loader";

interface Options {
    /** The roles that the link data items must have to be considered. */
    roles?: string | Iterable<string>;

    /** A query string to add to requests generated from discovered links. */
    requestQuery?: string;
}

/**
 * A plugin for the json-dependencies-loader which can create dependencies for
 * links with a specific set of roles with a specified query param.
 */
export class ItemDataLinkDependencyPlugin implements PluginObject {
    public static TAP_NAME = "ItemDataLinkDependencyPlugin";

    private readonly roles: Set<string>;
    private readonly requestQuery: string | null;

    constructor({ roles, requestQuery }: Options) {
        this.roles = new Set(typeof roles === "string" ? [roles] : roles || []);
        this.requestQuery = requestQuery || null;
    }

    public apply(hooks: DependencyResolutionHooks) {
        const options = ItemDataLinkDependencyPlugin.TAP_NAME;
        hooks.findReferences.tapPromise(
            options,
            async (
                references: Reference[],
                doc: any,
                context: webpack.LoaderContext<{}>
            ) => {
                const item = validateItem(doc);
                const ns = await NamespaceLoader.forWebpackLoader(
                    context
                ).loadNamespace(item);
                const links: LinkItemData[] = getData(item, ns, {
                    type: isLinkItemData,
                    roles: this.roles,
                });

                links.forEach((data) => {
                    let request = urlToRequest(data.href["@id"]);
                    if (this.requestQuery) {
                        request = `${request}?${this.requestQuery}`;
                    }
                    references.push({ request });
                });

                return references;
            }
        );
    }
}
