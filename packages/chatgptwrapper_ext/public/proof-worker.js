(function () {
  "use strict";

  var Zt = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
  var It = {
    exports: {}
  };
  /**
  * [js-sha3]{@link https://github.com/emn178/js-sha3}
  *
  * @version 0.9.3
  * @author Chen, Yi-Cyuan [emn178@gmail.com]
  * @copyright Chen, Yi-Cyuan 2015-2023
  * @license MIT
  */
  (function (v) {
    (function () {
      var y = "input is invalid type";
      var _ = "finalize already called";
      var S = typeof window == "object";
      var b = S ? window : {};
      if (b.JS_SHA3_NO_WINDOW) {
        S = false;
      }
      var C = !S && typeof self == "object";
      var Dt = !b.JS_SHA3_NO_NODE_JS && typeof process == "object" && process.versions && process.versions.node;
      if (Dt) {
        b = Zt;
      } else if (C) {
        b = self;
      }
      var $t = !b.JS_SHA3_NO_COMMON_JS && true && v.exports;
      var Ht = !b.JS_SHA3_NO_ARRAY_BUFFER && typeof ArrayBuffer !== "undefined";
      var p = "0123456789abcdef".split("");
      var st = [31, 7936, 2031616, 520093696];
      var Tt = [4, 1024, 262144, 67108864];
      var te = [1, 256, 65536, 16777216];
      var ee = [6, 1536, 393216, 100663296];
      var d = [0, 8, 16, 24];
      var zt = [1, 0, 32898, 0, 32906, 2147483648, 2147516416, 2147483648, 32907, 0, 2147483649, 0, 2147516545, 2147483648, 32777, 2147483648, 138, 0, 136, 0, 2147516425, 0, 2147483658, 0, 2147516555, 0, 139, 2147483648, 32905, 2147483648, 32771, 2147483648, 32770, 2147483648, 128, 2147483648, 32778, 0, 2147483658, 2147483648, 2147516545, 2147483648, 32896, 2147483648, 2147483649, 0, 2147516424, 2147483648];
      var Jt = [224, 256, 384, 512];
      var Ot = [128, 256];
      var Kt = ["hex", "buffer", "arrayBuffer", "array", "digest"];
      var jt = {
        128: 168,
        256: 136
      };
      var re = b.JS_SHA3_NO_NODE_JS || !Array.isArray ? function (t) {
        return Object.prototype.toString.call(t) === "[object Array]";
      } : Array.isArray;
      var ne = Ht && (b.JS_SHA3_NO_ARRAY_BUFFER_IS_VIEW || !ArrayBuffer.isView) ? function (t) {
        return typeof t == "object" && t.buffer && t.buffer.constructor === ArrayBuffer;
      } : ArrayBuffer.isView;
      var Mt = function (t) {
        var e = typeof t;
        if (e === "string") {
          return [t, true];
        }
        if (e !== "object" || t === null) {
          throw new Error(y);
        }
        if (Ht && t.constructor === ArrayBuffer) {
          return [new Uint8Array(t), false];
        }
        if (!re(t) && !ne(t)) {
          throw new Error(y);
        }
        return [t, false];
      };
      var Pt = function (t) {
        return Mt(t)[0].length === 0;
      };
      var gt = function (t) {
        var e = [];
        for (var r = 0; r < t.length; ++r) {
          e[r] = t[r];
        }
        return e;
      };
      var Ut = function (t, e, r) {
        return function (n) {
          return new h(t, e, t).update(n)[r]();
        };
      };
      var Wt = function (t, e, r) {
        return function (n, o) {
          return new h(t, e, o).update(n)[r]();
        };
      };
      var Gt = function (t, e, r) {
        return function (n, o, a, f) {
          return x["cshake" + t].update(n, o, a, f)[r]();
        };
      };
      var Yt = function (t, e, r) {
        return function (n, o, a, f) {
          return x["kmac" + t].update(n, o, a, f)[r]();
        };
      };
      var E = function (t, e, r, n) {
        for (var o = 0; o < Kt.length; ++o) {
          var a = Kt[o];
          t[a] = e(r, n, a);
        }
        return t;
      };
      var mt = function (t, e) {
        var r = Ut(t, e, "hex");
        r.create = function () {
          return new h(t, e, t);
        };
        r.update = function (n) {
          return r.create().update(n);
        };
        return E(r, Ut, t, e);
      };
      var oe = function (t, e) {
        var r = Wt(t, e, "hex");
        r.create = function (n) {
          return new h(t, e, n);
        };
        r.update = function (n, o) {
          return r.create(o).update(n);
        };
        return E(r, Wt, t, e);
      };
      var ae = function (t, e) {
        var r = jt[t];
        var n = Gt(t, e, "hex");
        n.create = function (o, a, f) {
          if (Pt(a) && Pt(f)) {
            return x["shake" + t].create(o);
          } else {
            return new h(t, e, o).bytepad([a, f], r);
          }
        };
        n.update = function (o, a, f, i) {
          return n.create(a, f, i).update(o);
        };
        return E(n, Gt, t, e);
      };
      var ie = function (t, e) {
        var r = jt[t];
        var n = Yt(t, e, "hex");
        n.create = function (o, a, f) {
          return new Nt(t, e, a).bytepad(["KMAC", f], r).bytepad([o], r);
        };
        n.update = function (o, a, f, i) {
          return n.create(o, f, i).update(a);
        };
        return E(n, Yt, t, e);
      };
      for (var Vt = [{
          name: "keccak",
          padding: te,
          bits: Jt,
          createMethod: mt
        }, {
          name: "sha3",
          padding: ee,
          bits: Jt,
          createMethod: mt
        }, {
          name: "shake",
          padding: st,
          bits: Ot,
          createMethod: oe
        }, {
          name: "cshake",
          padding: Tt,
          bits: Ot,
          createMethod: ae
        }, {
          name: "kmac",
          padding: Tt,
          bits: Ot,
          createMethod: ie
        }], x = {}, F = [], A = 0; A < Vt.length; ++A) {
        var k = Vt[A];
        for (var O = k.bits, w = 0; w < O.length; ++w) {
          var Rt = k.name + "_" + O[w];
          F.push(Rt);
          x[Rt] = k.createMethod(O[w], k.padding);
          if (k.name !== "sha3") {
            var Lt = k.name + O[w];
            F.push(Lt);
            x[Lt] = x[Rt];
          }
        }
      }
      function h(t, e, r) {
        this.blocks = [];
        this.s = [];
        this.padding = e;
        this.outputBits = r;
        this.reset = true;
        this.finalized = false;
        this.block = 0;
        this.start = 0;
        this.blockCount = 1600 - (t << 1) >> 5;
        this.byteCount = this.blockCount << 2;
        this.outputBlocks = r >> 5;
        this.extraBytes = (r & 31) >> 3;
        for (var n = 0; n < 50; ++n) {
          this.s[n] = 0;
        }
      }
      h.prototype.update = function (t) {
        if (this.finalized) {
          throw new Error(_);
        }
        var e = Mt(t);
        t = e[0];
        var r = e[1];
        var n = this.blocks;
        var o = this.byteCount;
        for (var a = t.length, f = this.blockCount, i = 0, l = this.s, u, c; i < a;) {
          if (this.reset) {
            this.reset = false;
            n[0] = this.block;
            u = 1;
            for (; u < f + 1; ++u) {
              n[u] = 0;
            }
          }
          if (r) {
            for (u = this.start; i < a && u < o; ++i) {
              c = t.charCodeAt(i);
              if (c < 128) {
                n[u >> 2] |= c << d[u++ & 3];
              } else if (c < 2048) {
                n[u >> 2] |= (c >> 6 | 192) << d[u++ & 3];
                n[u >> 2] |= (c & 63 | 128) << d[u++ & 3];
              } else if (c < 55296 || c >= 57344) {
                n[u >> 2] |= (c >> 12 | 224) << d[u++ & 3];
                n[u >> 2] |= (c >> 6 & 63 | 128) << d[u++ & 3];
                n[u >> 2] |= (c & 63 | 128) << d[u++ & 3];
              } else {
                c = 65536 + ((c & 1023) << 10 | t.charCodeAt(++i) & 1023);
                n[u >> 2] |= (c >> 18 | 240) << d[u++ & 3];
                n[u >> 2] |= (c >> 12 & 63 | 128) << d[u++ & 3];
                n[u >> 2] |= (c >> 6 & 63 | 128) << d[u++ & 3];
                n[u >> 2] |= (c & 63 | 128) << d[u++ & 3];
              }
            }
          } else {
            for (u = this.start; i < a && u < o; ++i) {
              n[u >> 2] |= t[i] << d[u++ & 3];
            }
          }
          this.lastByteIndex = u;
          if (u >= o) {
            this.start = u - o;
            this.block = n[f];
            u = 0;
            for (; u < f; ++u) {
              l[u] ^= n[u];
            }
            B(l);
            this.reset = true;
          } else {
            this.start = u;
          }
        }
        return this;
      };
      h.prototype.encode = function (t, e) {
        var r = t & 255;
        var n = 1;
        var o = [r];
        t = t >> 8;
        r = t & 255;
        while (r > 0) {
          o.unshift(r);
          t = t >> 8;
          r = t & 255;
          ++n;
        }
        if (e) {
          o.push(n);
        } else {
          o.unshift(n);
        }
        this.update(o);
        return o.length;
      };
      h.prototype.encodeString = function (t) {
        var e = Mt(t);
        t = e[0];
        var r = e[1];
        var n = 0;
        var o = t.length;
        if (r) {
          for (var a = 0; a < t.length; ++a) {
            var f = t.charCodeAt(a);
            if (f < 128) {
              n += 1;
            } else if (f < 2048) {
              n += 2;
            } else if (f < 55296 || f >= 57344) {
              n += 3;
            } else {
              f = 65536 + ((f & 1023) << 10 | t.charCodeAt(++a) & 1023);
              n += 4;
            }
          }
        } else {
          n = o;
        }
        n += this.encode(n * 8);
        this.update(t);
        return n;
      };
      h.prototype.bytepad = function (t, e) {
        var r = this.encode(e);
        for (var n = 0; n < t.length; ++n) {
          r += this.encodeString(t[n]);
        }
        var o = (e - r % e) % e;
        var a = [];
        a.length = o;
        this.update(a);
        return this;
      };
      h.prototype.finalize = function () {
        if (!this.finalized) {
          this.finalized = true;
          var t = this.blocks;
          var e = this.lastByteIndex;
          var r = this.blockCount;
          var n = this.s;
          t[e >> 2] |= this.padding[e & 3];
          if (this.lastByteIndex === this.byteCount) {
            t[0] = t[r];
            e = 1;
            for (; e < r + 1; ++e) {
              t[e] = 0;
            }
          }
          t[r - 1] |= 2147483648;
          e = 0;
          for (; e < r; ++e) {
            n[e] ^= t[e];
          }
          B(n);
        }
      };
      h.prototype.toString = h.prototype.hex = function () {
        this.finalize();
        var t = this.blockCount;
        for (var e = this.s, r = this.outputBlocks, n = this.extraBytes, o = 0, a = 0, f = "", i; a < r;) {
          for (o = 0; o < t && a < r; ++o, ++a) {
            i = e[o];
            f += p[i >> 4 & 15] + p[i & 15] + p[i >> 12 & 15] + p[i >> 8 & 15] + p[i >> 20 & 15] + p[i >> 16 & 15] + p[i >> 28 & 15] + p[i >> 24 & 15];
          }
          if (a % t === 0) {
            e = gt(e);
            B(e);
            o = 0;
          }
        }
        if (n) {
          i = e[o];
          f += p[i >> 4 & 15] + p[i & 15];
          if (n > 1) {
            f += p[i >> 12 & 15] + p[i >> 8 & 15];
          }
          if (n > 2) {
            f += p[i >> 20 & 15] + p[i >> 16 & 15];
          }
        }
        return f;
      };
      h.prototype.arrayBuffer = function () {
        this.finalize();
        var t = this.blockCount;
        var e = this.s;
        var r = this.outputBlocks;
        var n = this.extraBytes;
        var o = 0;
        var a = 0;
        var f = this.outputBits >> 3;
        var i;
        if (n) {
          i = new ArrayBuffer(r + 1 << 2);
        } else {
          i = new ArrayBuffer(f);
        }
        var l = new Uint32Array(i);
        for (; a < r;) {
          for (o = 0; o < t && a < r; ++o, ++a) {
            l[a] = e[o];
          }
          if (a % t === 0) {
            e = gt(e);
            B(e);
          }
        }
        if (n) {
          l[a] = e[o];
          i = i.slice(0, f);
        }
        return i;
      };
      h.prototype.buffer = h.prototype.arrayBuffer;
      h.prototype.digest = h.prototype.array = function () {
        this.finalize();
        var t = this.blockCount;
        for (var e = this.s, r = this.outputBlocks, n = this.extraBytes, o = 0, a = 0, f = [], i, l; a < r;) {
          for (o = 0; o < t && a < r; ++o, ++a) {
            i = a << 2;
            l = e[o];
            f[i] = l & 255;
            f[i + 1] = l >> 8 & 255;
            f[i + 2] = l >> 16 & 255;
            f[i + 3] = l >> 24 & 255;
          }
          if (a % t === 0) {
            e = gt(e);
            B(e);
          }
        }
        if (n) {
          i = a << 2;
          l = e[o];
          f[i] = l & 255;
          if (n > 1) {
            f[i + 1] = l >> 8 & 255;
          }
          if (n > 2) {
            f[i + 2] = l >> 16 & 255;
          }
        }
        return f;
      };
      function Nt(t, e, r) {
        h.call(this, t, e, r);
      }
      Nt.prototype = new h();
      Nt.prototype.finalize = function () {
        this.encode(this.outputBits, true);
        return h.prototype.finalize.call(this);
      };
      function B(t) {
        var e;
        var r;
        var n;
        var o;
        var a;
        var f;
        var i;
        var l;
        var u;
        var c;
        var M;
        var g;
        var R;
        var N;
        var I;
        var D;
        var H;
        var T;
        var z;
        var J;
        var K;
        var j;
        var P;
        var U;
        var W;
        var G;
        var Y;
        var m;
        var V;
        var L;
        var Z;
        var Q;
        var X;
        var q;
        var $;
        var s;
        var tt;
        var et;
        var rt;
        var nt;
        var ot;
        var at;
        var it;
        var ft;
        var ut;
        var ct;
        var ht;
        var lt;
        var pt;
        var bt;
        var dt;
        var vt;
        var yt;
        var xt;
        var At;
        var kt;
        var _t;
        var St;
        var Ft;
        var wt;
        var Bt;
        var Ct;
        var Et;
        for (n = 0; n < 48; n += 2) {
          o = t[0] ^ t[10] ^ t[20] ^ t[30] ^ t[40];
          a = t[1] ^ t[11] ^ t[21] ^ t[31] ^ t[41];
          f = t[2] ^ t[12] ^ t[22] ^ t[32] ^ t[42];
          i = t[3] ^ t[13] ^ t[23] ^ t[33] ^ t[43];
          l = t[4] ^ t[14] ^ t[24] ^ t[34] ^ t[44];
          u = t[5] ^ t[15] ^ t[25] ^ t[35] ^ t[45];
          c = t[6] ^ t[16] ^ t[26] ^ t[36] ^ t[46];
          M = t[7] ^ t[17] ^ t[27] ^ t[37] ^ t[47];
          g = t[8] ^ t[18] ^ t[28] ^ t[38] ^ t[48];
          R = t[9] ^ t[19] ^ t[29] ^ t[39] ^ t[49];
          e = g ^ (f << 1 | i >>> 31);
          r = R ^ (i << 1 | f >>> 31);
          t[0] ^= e;
          t[1] ^= r;
          t[10] ^= e;
          t[11] ^= r;
          t[20] ^= e;
          t[21] ^= r;
          t[30] ^= e;
          t[31] ^= r;
          t[40] ^= e;
          t[41] ^= r;
          e = o ^ (l << 1 | u >>> 31);
          r = a ^ (u << 1 | l >>> 31);
          t[2] ^= e;
          t[3] ^= r;
          t[12] ^= e;
          t[13] ^= r;
          t[22] ^= e;
          t[23] ^= r;
          t[32] ^= e;
          t[33] ^= r;
          t[42] ^= e;
          t[43] ^= r;
          e = f ^ (c << 1 | M >>> 31);
          r = i ^ (M << 1 | c >>> 31);
          t[4] ^= e;
          t[5] ^= r;
          t[14] ^= e;
          t[15] ^= r;
          t[24] ^= e;
          t[25] ^= r;
          t[34] ^= e;
          t[35] ^= r;
          t[44] ^= e;
          t[45] ^= r;
          e = l ^ (g << 1 | R >>> 31);
          r = u ^ (R << 1 | g >>> 31);
          t[6] ^= e;
          t[7] ^= r;
          t[16] ^= e;
          t[17] ^= r;
          t[26] ^= e;
          t[27] ^= r;
          t[36] ^= e;
          t[37] ^= r;
          t[46] ^= e;
          t[47] ^= r;
          e = c ^ (o << 1 | a >>> 31);
          r = M ^ (a << 1 | o >>> 31);
          t[8] ^= e;
          t[9] ^= r;
          t[18] ^= e;
          t[19] ^= r;
          t[28] ^= e;
          t[29] ^= r;
          t[38] ^= e;
          t[39] ^= r;
          t[48] ^= e;
          t[49] ^= r;
          N = t[0];
          I = t[1];
          ct = t[11] << 4 | t[10] >>> 28;
          ht = t[10] << 4 | t[11] >>> 28;
          m = t[20] << 3 | t[21] >>> 29;
          V = t[21] << 3 | t[20] >>> 29;
          wt = t[31] << 9 | t[30] >>> 23;
          Bt = t[30] << 9 | t[31] >>> 23;
          at = t[40] << 18 | t[41] >>> 14;
          it = t[41] << 18 | t[40] >>> 14;
          q = t[2] << 1 | t[3] >>> 31;
          $ = t[3] << 1 | t[2] >>> 31;
          D = t[13] << 12 | t[12] >>> 20;
          H = t[12] << 12 | t[13] >>> 20;
          lt = t[22] << 10 | t[23] >>> 22;
          pt = t[23] << 10 | t[22] >>> 22;
          L = t[33] << 13 | t[32] >>> 19;
          Z = t[32] << 13 | t[33] >>> 19;
          Ct = t[42] << 2 | t[43] >>> 30;
          Et = t[43] << 2 | t[42] >>> 30;
          xt = t[5] << 30 | t[4] >>> 2;
          At = t[4] << 30 | t[5] >>> 2;
          s = t[14] << 6 | t[15] >>> 26;
          tt = t[15] << 6 | t[14] >>> 26;
          T = t[25] << 11 | t[24] >>> 21;
          z = t[24] << 11 | t[25] >>> 21;
          bt = t[34] << 15 | t[35] >>> 17;
          dt = t[35] << 15 | t[34] >>> 17;
          Q = t[45] << 29 | t[44] >>> 3;
          X = t[44] << 29 | t[45] >>> 3;
          U = t[6] << 28 | t[7] >>> 4;
          W = t[7] << 28 | t[6] >>> 4;
          kt = t[17] << 23 | t[16] >>> 9;
          _t = t[16] << 23 | t[17] >>> 9;
          et = t[26] << 25 | t[27] >>> 7;
          rt = t[27] << 25 | t[26] >>> 7;
          J = t[36] << 21 | t[37] >>> 11;
          K = t[37] << 21 | t[36] >>> 11;
          vt = t[47] << 24 | t[46] >>> 8;
          yt = t[46] << 24 | t[47] >>> 8;
          ft = t[8] << 27 | t[9] >>> 5;
          ut = t[9] << 27 | t[8] >>> 5;
          G = t[18] << 20 | t[19] >>> 12;
          Y = t[19] << 20 | t[18] >>> 12;
          St = t[29] << 7 | t[28] >>> 25;
          Ft = t[28] << 7 | t[29] >>> 25;
          nt = t[38] << 8 | t[39] >>> 24;
          ot = t[39] << 8 | t[38] >>> 24;
          j = t[48] << 14 | t[49] >>> 18;
          P = t[49] << 14 | t[48] >>> 18;
          t[0] = N ^ ~D & T;
          t[1] = I ^ ~H & z;
          t[10] = U ^ ~G & m;
          t[11] = W ^ ~Y & V;
          t[20] = q ^ ~s & et;
          t[21] = $ ^ ~tt & rt;
          t[30] = ft ^ ~ct & lt;
          t[31] = ut ^ ~ht & pt;
          t[40] = xt ^ ~kt & St;
          t[41] = At ^ ~_t & Ft;
          t[2] = D ^ ~T & J;
          t[3] = H ^ ~z & K;
          t[12] = G ^ ~m & L;
          t[13] = Y ^ ~V & Z;
          t[22] = s ^ ~et & nt;
          t[23] = tt ^ ~rt & ot;
          t[32] = ct ^ ~lt & bt;
          t[33] = ht ^ ~pt & dt;
          t[42] = kt ^ ~St & wt;
          t[43] = _t ^ ~Ft & Bt;
          t[4] = T ^ ~J & j;
          t[5] = z ^ ~K & P;
          t[14] = m ^ ~L & Q;
          t[15] = V ^ ~Z & X;
          t[24] = et ^ ~nt & at;
          t[25] = rt ^ ~ot & it;
          t[34] = lt ^ ~bt & vt;
          t[35] = pt ^ ~dt & yt;
          t[44] = St ^ ~wt & Ct;
          t[45] = Ft ^ ~Bt & Et;
          t[6] = J ^ ~j & N;
          t[7] = K ^ ~P & I;
          t[16] = L ^ ~Q & U;
          t[17] = Z ^ ~X & W;
          t[26] = nt ^ ~at & q;
          t[27] = ot ^ ~it & $;
          t[36] = bt ^ ~vt & ft;
          t[37] = dt ^ ~yt & ut;
          t[46] = wt ^ ~Ct & xt;
          t[47] = Bt ^ ~Et & At;
          t[8] = j ^ ~N & D;
          t[9] = P ^ ~I & H;
          t[18] = Q ^ ~U & G;
          t[19] = X ^ ~W & Y;
          t[28] = at ^ ~q & s;
          t[29] = it ^ ~$ & tt;
          t[38] = vt ^ ~ft & ct;
          t[39] = yt ^ ~ut & ht;
          t[48] = Ct ^ ~xt & kt;
          t[49] = Et ^ ~At & _t;
          t[0] ^= zt[n];
          t[1] ^= zt[n + 1];
        }
      }
      if ($t) {
        v.exports = x;
      } else {
        for (A = 0; A < F.length; ++A) {
          b[F[A]] = x[F[A]];
        }
      }
    })();
  })(It);
  var Qt = It.exports;
  function Xt(v) {
    const y = JSON.stringify(v);
    return btoa(String.fromCharCode(...new TextEncoder().encode(y)));
  }
  function qt(v, y, _) {
    const S = performance.now();
    for (let b = 0; b < 500000; b++) {
      _[3] = b;
      _[9] = Math.round(performance.now() - S);
      const C = Xt(_);
      if (Qt.sha3_512(v + C).slice(0, y.length) <= y) {
        return C;
      }
    }
    return "wQ8Lk5FbGpA2NcR9dShT6gYjU7VxZ4De";
  }
  self.addEventListener("message", v => {
    const y = qt(v.data.seed, v.data.difficulty, v.data.config);
    postMessage(y);
  });
})();
//# sourceMappingURL=worker-DrXR2XoY.js.map