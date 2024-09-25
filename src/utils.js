import fetch from 'node-fetch';
import config from '../config.cjs';

/**
 * @typedef {import('node-fetch').RequestInit} RequestInit
 */

/** @param {string} link */
export function apiUrl(link) {
    if (link[0] == '/') // fail safe
        link = link.substring(1);
    
    const url = new URL(link,
        new URL('/api/', config.link)
    );
    
    return url.toString();
}

/**
 * @param {string} link
 * @param {(Omit<RequestInit, 'body'> & { body?: RequestInit['body'] | Object<string, any> | null }) | undefined} request
 * @param {{
 *  addContentTypeJson?: boolean,
 * }} opts
 */
export async function apiRaw(link, request = {}, opts = {}) {
    const method = request?.method;
    
    if (method && method.toUpperCase() != 'GET' && (
        opts.addContentTypeJson === undefined ||
        opts.addContentTypeJson === true
    )) {
        const headers = request.headers;
        const body = request.body;
        
        let isContentType = false;
        
        if (body && typeof body === 'object')
            request.body = JSON.stringify(body);
        
        if (headers && body) {
            for (const [key] of Object.entries(headers)) {
                if (key.toLocaleLowerCase() == 'content-type') {
                    isContentType = true;
                }
            }
            
            if (!isContentType) // @ts-ignore
                headers['Content-Type'] = 'application/json';
        } else if (body) {
            request.headers = { 'Content-Type': 'application/json' };
        }
    }
    
    return fetch(apiUrl(link), /** @type {RequestInit} */ (request));
}

/**
 * @param {Parameters<typeof apiRaw>[0]} link
 * @param {Parameters<typeof apiRaw>[1]} request
 * @param {Parameters<typeof apiRaw>[2]} opts
 */
export function api(link, request = {}, opts = {}) {
    return new Promise(async (resolve, reject) => {
        const answer = await apiRaw(link, request, opts);
        const headCT = answer.headers.get('content-type');
        
        if (headCT && headCT.includes('application/json')) {
            const data = /** @type {any} */ (await answer.json());
            
            if (data.error)
                return reject([ link, data.error ]);
            
            return resolve([ link, data]);
        } else {
            return reject(new Error('Unexpected content type: ' + headCT + ' for ' + link + ': ' + await answer.text()));
        }
    });
}