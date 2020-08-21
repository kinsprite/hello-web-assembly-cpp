"use strick";

(() => {
  // Map multiple JavaScript environments to a single common API,
  // preferring web standards over Node.js API.
  //
  // Environments considered:
  // - Browsers
  // - Node.js
  // - Electron
  // - Parcel

  if (typeof global !== 'undefined') {
    // global already exists
  } else if (typeof window !== 'undefined') {
    window.global = window;
  } else if (typeof self !== 'undefined') {
    self.global = self;
  } else {
    throw new Error('cannot export Go (neither global, window nor self is defined)');
  }

  if (!WebAssembly.instantiateStreaming) { // polyfill
      WebAssembly.instantiateStreaming = async (resp, importObject) => {
          const source = await (await resp).arrayBuffer();
          return await WebAssembly.instantiate(source, importObject);
      };
  }

  var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;

  /**
   * @param {number} idx
   * @param {number=} maxBytesToRead
   * @return {string}
   */
  function UTF8ArrayToString(heap, idx, maxBytesToRead) {
    var endIdx = idx + maxBytesToRead;
    var endPtr = idx;
    // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
    // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
    // (As a tiny code save trick, compare endPtr against endIdx using a negation, so that undefined means Infinity)
    while (heap[endPtr] && !(endPtr >= endIdx)) ++endPtr;

    if (endPtr - idx > 16 && heap.subarray && UTF8Decoder) {
      return UTF8Decoder.decode(heap.subarray(idx, endPtr));
    } else {
      var str = '';
      // If building with TextDecoder, we have already computed the string length above, so test loop end condition against that
      while (idx < endPtr) {
        // For UTF8 byte structure, see:
        // http://en.wikipedia.org/wiki/UTF-8#Description
        // https://www.ietf.org/rfc/rfc2279.txt
        // https://tools.ietf.org/html/rfc3629
        var u0 = heap[idx++];
        if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
        var u1 = heap[idx++] & 63;
        if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
        var u2 = heap[idx++] & 63;
        if ((u0 & 0xF0) == 0xE0) {
          u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
        } else {
          if ((u0 & 0xF8) != 0xF0) warnOnce('Invalid UTF-8 leading byte 0x' + u0.toString(16) + ' encountered when deserializing a UTF-8 string on the asm.js/wasm heap to a JS string!');
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heap[idx++] & 63);
        }

        if (u0 < 0x10000) {
          str += String.fromCharCode(u0);
        } else {
          var ch = u0 - 0x10000;
          str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
        }
      }
    }
    return str;
  }

  // Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns a
  // copy of that string as a Javascript String object.
  // maxBytesToRead: an optional length that specifies the maximum number of bytes to read. You can omit
  //                 this parameter to scan the string until the first \0 byte. If maxBytesToRead is
  //                 passed, and the string at [ptr, ptr+maxBytesToReadr[ contains a null byte in the
  //                 middle, then the string will cut short at that byte index (i.e. maxBytesToRead will
  //                 not produce a string of exact length [ptr, ptr+maxBytesToRead[)
  //                 N.B. mixing frequent uses of UTF8ToString() with and without maxBytesToRead may
  //                 throw JS JIT optimizations off, so it is worth to consider consistently using one
  //                 style or the other.
  /**
   * @param {number} ptr
   * @param {number=} maxBytesToRead
   * @return {string}
   */
  function UTF8ToString(ptr, maxBytesToRead) {
    return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : '';
  }

  function createAsmArg() {
    var INITIAL_INITIAL_MEMORY = 16777216;
    var WASM_PAGE_SIZE = 65536;

    var DYNAMIC_BASE = 5247264;
    var DYNAMICTOP_PTR = 4224;

    // Wasm globals
    var wasmMemory = new WebAssembly.Memory({
      'initial': INITIAL_INITIAL_MEMORY / WASM_PAGE_SIZE,
      'maximum': INITIAL_INITIAL_MEMORY / WASM_PAGE_SIZE,
    })

    // In fastcomp asm.js, we don't need a wasm Table at all.
    // In the wasm backend, we polyfill the WebAssembly object,
    // so this creates a (non-native-wasm) table for us.

    var wasmTable = new WebAssembly.Table({
      'initial': 26,
      'maximum': 26 + 0,
      'element': 'anyfunc'
    });

    var ABORT = false;

    var HEAP,
      /** @type {ArrayBuffer} */
        buffer,
      /** @type {Int8Array} */
        HEAP8,
      /** @type {Uint8Array} */
        HEAPU8,
      /** @type {Int16Array} */
        HEAP16,
      /** @type {Uint16Array} */
        HEAPU16,
      /** @type {Int32Array} */
        HEAP32,
      /** @type {Uint32Array} */
        HEAPU32,
      /** @type {Float32Array} */
        HEAPF32,
      /** @type {Float64Array} */
        HEAPF64;

    var EXITSTATUS = 0;

    var out = console.log.bind(console);
    var err = console.warn.bind(console);

    var SYSCALLS = {
      mappings:{},
      buffers:[null,[],[]],
      printChar: function(stream, curr) {
        var buffer = SYSCALLS.buffers[stream];
        assert(buffer);
        if (curr === 0 || curr === 10) {
          (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
          buffer.length = 0;
        } else {
          buffer.push(curr);
        }
      },
      varargs: undefined,
      get: function() {
        assert(SYSCALLS.varargs != undefined);
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },
      getStr:function(ptr) {
        var ret = UTF8ToString(ptr);
        return ret;
      },
      get64:function(low, high) {
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      }
    };

    /** @param {string|number=} what */
    function abort(what) {
      what += '';
      err(what);

      ABORT = true;
      EXITSTATUS = 1;

      var output = 'abort(' + what + ') at ' + stackTrace();
      what = output;

      // Use a wasm runtime error, because a JS error might be seen as a foreign
      // exception, which means we'd run destructors on it. We need the error to
      // simply make the program stop.
      var e = new WebAssembly.RuntimeError(what);

      // Throw the error whether or not MODULARIZE is set because abort is used
      // in code paths apart from instantiation where an exception is expected
      // to be thrown when abort is called.
      throw e;
    }

    /** @type {function(*, string=)} */
    function assert(condition, text) {
      if (!condition) {
        abort('Assertion failed: ' + text);
      }
    }

    function ___handle_stack_overflow() {
      abort('stack overflow')
    }

    function _abort() {
      abort();
    }

    function _emscripten_get_sbrk_ptr() {
      return 4224;
    }

    function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.copyWithin(dest, src, src + num);
    }

    function abortOnCannotGrowMemory(requestedSize) {
      abort('Cannot enlarge memory arrays to size ' + requestedSize + ' bytes (OOM). Either (1) compile with  -s INITIAL_MEMORY=X  with X higher than the current value ' + HEAP8.length + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
    }

    function _emscripten_resize_heap(requestedSize) {
      requestedSize = requestedSize >>> 0;
      abortOnCannotGrowMemory(requestedSize);
    }

    function _fd_write(fd, iov, iovcnt, pnum) {
      // hack to support printf in SYSCALLS_REQUIRE_FILESYSTEM=0
      var num = 0;
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[(((iov)+(i*8))>>2)];
        var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
        for (var j = 0; j < len; j++) {
          SYSCALLS.printChar(fd, HEAPU8[ptr+j]);
        }
        num += len;
      }
      HEAP32[((pnum)>>2)]=num
      return 0;
    }

    function updateGlobalBufferAndViews(buf) {
      buffer = buf;
      HEAP8 = new Int8Array(buf);
      HEAP16 = new Int16Array(buf);
      HEAP32 = new Int32Array(buf);
      HEAPU8 = new Uint8Array(buf);
      HEAPU16 = new Uint16Array(buf);
      HEAPU32 = new Uint32Array(buf);
      HEAPF32 = new Float32Array(buf);
      HEAPF64 = new Float64Array(buf);
    }

    var tempRet0 = 0;

    var setTempRet0 = function(value) {
      tempRet0 = value;
    };

    var getTempRet0 = function() {
      return tempRet0;
    };

    function _setTempRet0($i) {
      setTempRet0(($i) | 0);
    }

    if (wasmMemory) {
      buffer = wasmMemory.buffer;
    }

    // If the user provides an incorrect length, just use that length instead rather than providing the user to
    // specifically provide the memory length with Module['INITIAL_MEMORY'].
    INITIAL_INITIAL_MEMORY = buffer.byteLength;
    assert(INITIAL_INITIAL_MEMORY % WASM_PAGE_SIZE === 0);
    updateGlobalBufferAndViews(buffer);

    HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;

    const asmGlobalArg = {};
    const asmLibraryArg = {
      __handle_stack_overflow: ___handle_stack_overflow,
      abort: _abort,
      emscripten_get_sbrk_ptr: _emscripten_get_sbrk_ptr,
      emscripten_memcpy_big: _emscripten_memcpy_big,
      emscripten_resize_heap: _emscripten_resize_heap,
      fd_write: _fd_write,
      memory: wasmMemory,
      setTempRet0: _setTempRet0,
      table: wasmTable
    };

    return {asmGlobalArg, asmLibraryArg};
  }

  global.Cpp = class Cpp {
    constructor() {
      const arg = createAsmArg();

      this.importObject = {
        env: arg.asmLibraryArg,
        wasi_snapshot_preview1: arg.asmLibraryArg,
      };
    }
  }

  global.Cpp.createWasm = (url) => {
    const cpp = new global.Cpp();
    return WebAssembly.instantiateStreaming(fetch(url), cpp.importObject);
  }
})();
