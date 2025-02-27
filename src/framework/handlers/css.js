import { http } from '../../platform/net/http.js';

class CssHandler {
    /**
     * Type of the resource the handler handles.
     *
     * @type {string}
     */
    handlerType = "css";

    constructor(app) {
        this.maxRetries = 0;
    }

    load(url, callback) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        http.get(url.load, {
            retry: this.maxRetries > 0,
            maxRetries: this.maxRetries
        }, function (err, response) {
            if (!err) {
                callback(null, response);
            } else {
                callback(`Error loading css resource: ${url.original} [${err}]`);
            }
        });
    }

    open(url, data) {
        return data;
    }

    patch(asset, assets) {
    }
}

/**
 * Creates a &lt;style&gt; DOM element from a string that contains CSS.
 *
 * @param {string} cssString - A string that contains valid CSS.
 * @returns {Element} The style DOM element.
 * @example
 * var css = 'body {height: 100;}';
 * var style = pc.createStyle(css);
 * document.head.appendChild(style);
 */
function createStyle(cssString) {
    const result = document.createElement('style');
    result.type = 'text/css';
    if (result.styleSheet) {
        result.styleSheet.cssText = cssString;
    } else {
        result.appendChild(document.createTextNode(cssString));
    }

    return result;
}

export { createStyle, CssHandler };
