/**
 * @module Internal
 */

import * as normalizeUrl from "normalize-url";

export default function normalize(url: string): string {
    return normalizeUrl(url, {
        stripWWW: false,
        removeTrailingSlash: false,
        removeQueryParameters: [/.*/g],
    });
}