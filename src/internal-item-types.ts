type Orientation = 'portrait' | 'landscape';

interface TopLevelDescriptiveMetadataProperties {
    ID: string;
    thumbnailUrl?: string;
    thumbnailOrientation?: Orientation;
    displayImageRights?: string;
    downloadImageRights?: string;
    imageReproPageURL?: string;
    docAuthority?: string;
    type?: 'text';
    manuscript?: boolean;
    itemReferences?: Array<{ID: string}>;
}

interface NestedMetadata {
    label?: never;
    value: MetadataContainer[];
    [key: string]: any;
}

interface DisplayableMetadataBase {
    display: boolean;
    seq: number;
    label: string;
}

interface SingleDisplayableMetadata {
    displayForm: string;
    linktype?: 'keyword search';
    value?: never;

    // Additional arbitrary properties allowed
    [key: string]: any;
}

interface MultipleDisplayableMetadata {
    value: SingleDisplayableMetadata[];
    displayForm?: never;

    // Additional arbitrary properties allowed
    [key: string]: any;
}

type DisplayableMetadata = DisplayableMetadataBase & (SingleDisplayableMetadata | MultipleDisplayableMetadata);

type MetadataKeys = 'display' | 'displayForm' | 'label' | 'linktype' | 'seq' | 'value';
type NonDisplayableMetadata = {
    // Anything except reserved metadata keys
    [K in string]: K extends MetadataKeys ? never : any
};

interface MetadataContainer {
    [key: string]: NestedMetadata | DisplayableMetadata | NonDisplayableMetadata;
}

type DescriptiveMetadataSection = TopLevelDescriptiveMetadataProperties & MetadataContainer;

interface Page {
    label: string;
    physID: string;
    sequence: number;
    displayImageURL?: string;
    downloadImageURL?: string;
    IIIFImageURL?: string;
    thumbnailImageURL?: string;
    thumbnailImageOrientation?: Orientation;
    imageWidth?: number;
    imageHeight?: number;
    transcriptionNormalisedURL?: string;
    transcriptionDiplomaticURL?: string;
    translationURL?: string;
    /** Used in itemType: essay to hold the text of the essay constituting the item */
    content?: string;
    pageType?: string;
}

interface LogicalStructureNode {
    descriptiveMetadataID: string;
    endPagePosition: number;
    label: string;
    startPageLabel: string;
    startPagePosition: number;

    children?: LogicalStructureNode[];
    endPageID?: string;
    endPageLabel?: string;
    startPageID?: string;
}

interface ListItemPage {
    fileID: string;
    dmdID: string;
    startPageLabel: string;
    startPage: number;
    title: string;
    listItemText: string;
}

interface ItemProperties {
    textDirection?: 'L' | 'R';
    itemType?: 'essay';
    numberOfPages?: number;
    embeddable?: boolean;
    sourceData?: string;
    useTranscriptions?: boolean;
    useNormalisedTranscriptions?: boolean;
    useDiplomaticTranscriptions?: boolean;
    allTranscriptionDiplomaticURL?: string;
    useTranslations?: boolean;
    completeness?: string;
}

interface ItemStructure {
    descriptiveMetadata: DescriptiveMetadataSection[];
    page: Page[];
    logicalStructures: LogicalStructureNode[];
    listItemPages: ListItemPage[];
}

type InternalItem = ItemProperties & ItemStructure;
