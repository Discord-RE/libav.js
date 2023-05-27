/*
 * Copyright (C) 2019-2023 Yahweasel
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
 * SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION
 * OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
 * CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

if (LibAVFactory) (globalThis || window || self).LibAVFactory = LibAVFactory

if (/* We're in a worker */
    typeof importScripts !== "undefined" &&
    /* We haven't explicitly been requested not to load */
    (typeof LibAV === "undefined"  || !LibAV.nolibavworker) &&
    /* We're not being loaded as a thread */
    typeof Module === "undefined"
    ) {
    // We're the primary code for this worker   
    var libav;
    onmessage = function (e) {
            if (e && e.data && e.data.config) {
                if (e.data.config.wasmurl) {
                    var gt = (globalThis || window || self)
                    if (!gt.LibAV) gt.LibAV = {}
                    gt.LibAV.wasmurl =  e.data.config.wasmurl
                } 
                LibAVFactory().then(function (lib) {
                   libav = lib;
                   libav.onwrite = function(name, pos, buf) {
                        /* We have to buf.slice(0) so we don't duplicate the entire heap just
                         * to get one part of it in postMessage */
                        buf = buf.slice(0);
                        postMessage(["onwrite", "onwrite", true, [name, pos, buf]], [buf.buffer]);
                    };

                    libav.onblockread = function(name, pos, len) {
                        postMessage(["onblockread", "onblockread", true, [name, pos, len]]);
                    };
                    postMessage(["onready", "onready", true, null]);
                }).catch(function (ex) {
                    console.log('Loading LibAV failed' + '\n' + ex.stack);
                });
                return;
            } 

            var id = e.data[0];
            var fun = e.data[1];
            var args = e.data.slice(2);
            var ret = void 0;
            var succ = true;
            try {
                ret = libav[fun].apply(libav, args);
            } catch (ex) {
                succ = false;
                ret = ex.toString() + "\n" + ex.stack;
            }
            if (succ && typeof ret === "object" && ret !== null && ret.then) {
                // Let the promise resolve
                ret.then(function(res) {
                    ret = res;
                }).catch(function(ex) {
                    succ = false;
                    ret = ex.toString() + "\n" + ex.stack;
                }).then(function() {
                    postMessage([id, fun, succ, ret]);
                });

            } else {
                postMessage([id, fun, succ, ret]);

            }
        };
}
