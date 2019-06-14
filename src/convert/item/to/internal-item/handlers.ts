import {Page as InternalPage} from '../../../../internal-item-types';
import {DescriptionSection, isImageItemResource, Item} from '../../../../item-types';
import {CDLType, Namespace} from '../../../../uris';
import {ItemToInternalItemConversionHooks, ItemToInternalItemConverter, PageResourceContext} from './index';

abstract class BasePlugin {
    public abstract readonly pluginName: string;

    public apply(target: ItemToInternalItemConverter): void;
    public apply(target: ItemToInternalItemConversionHooks, item: Item): void;
    public apply(target: ItemToInternalItemConverter | ItemToInternalItemConversionHooks, item?: Item): void {
        if(target instanceof ItemToInternalItemConverter) {
            target.hooks.conversion.tap(this.pluginName, this.applyHooks.bind(this));
        }
        else {
            if(item === undefined) throw new Error('item was undefined');
            this.applyHooks(target, item);
        }
    }

    protected abstract applyHooks(hooks: ItemToInternalItemConversionHooks, item: Item): void;
}

export class InlineNamespacePlugin extends BasePlugin {
    public readonly pluginName = 'InlineNamespacePlugin';

    public async handleCreateNamespace(item: Item) {
        const itemNs = item['@namespace'];
        if(typeof itemNs === 'string') {
            throw new Error(`\
The InlineNamespacePlugin doesn't support resolving namespace references: ${item['@namespace']}`);
        }
        return Namespace.fromNamespaceMap(itemNs === undefined ? {} : itemNs);
    }

    protected applyHooks(hooks: ItemToInternalItemConversionHooks, item: Item): void {
        hooks.createNamespace.tapPromise(this.pluginName, this.handleCreateNamespace.bind(this, [item]));
    }
}

/** A plugin which need to know which Item instance it operates on. */
abstract class ContextFreeBasePlugin extends BasePlugin {
    public apply(target: ItemToInternalItemConverter | ItemToInternalItemConversionHooks): void {
        if(target instanceof ItemToInternalItemConverter) {
            super.apply(target);
        }
        else {
            this.applyHooks(target);
        }
    }

    protected abstract applyHooks(hooks: ItemToInternalItemConversionHooks): void;
}

export class IIIFPageResourcePlugin extends ContextFreeBasePlugin {
    public readonly pluginName = 'IIIFPageResourcePlugin';

    public async handleIIIFImagePageResource(convertedPage: InternalPage,
                                             {resource, namespace}: PageResourceContext): Promise<InternalPage> {
        if(!isImageItemResource(resource, namespace)) { return convertedPage; }
        if(resource.imageType !== 'iiif') { return convertedPage; }

        return {
            ...convertedPage,
            IIIFImageURL: resource.image['@id'],
        };
    }

    protected applyHooks(hooks: ItemToInternalItemConversionHooks): void {
        hooks.pageResource.tapPromise(CDLType.Image, this.pluginName, this.handleIIIFImagePageResource);
    }
}

export class DescriptionTitlePlugin extends ContextFreeBasePlugin {
    public readonly pluginName = 'DescriptionTitlePlugin';

    public getTitle(description: DescriptionSection): string | undefined {
        if(description.attributes === undefined) return;
        const title = description.attributes.title;
        if(title === undefined) return;

        if(typeof title.value === 'string')
            return title.value;
        return title.value[0];
    }

    protected applyHooks(hooks: ItemToInternalItemConversionHooks): void {
        hooks.descriptionTitle.tap(this.pluginName, this.getTitle);
    }
}
