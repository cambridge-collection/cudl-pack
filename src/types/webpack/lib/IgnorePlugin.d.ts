import {Plugin} from 'webpack';
import {IgnorePluginOptions} from 'webpack/declarations/plugins/IgnorePlugin';

export default class IgnorePlugin extends Plugin {
    constructor(options: IgnorePluginOptions);
}
