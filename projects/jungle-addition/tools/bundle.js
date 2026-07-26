#!/usr/bin/env node
/* bundle.js — fold index.html and everything it loads into one portable file.
   The multi-file version under js/ and css/ stays the source of truth; run this
   after editing it to refresh the single-file build for AirDrop.

   Usage:  node tools/bundle.js
   Output: jungle-addition.html  (no external references, opens from file://) */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'index.html');
const OUTPUT = path.join(ROOT, 'jungle-addition.html');

const STYLESHEET = /[ \t]*<link rel="stylesheet" href="([^"]+)">\n?/g;
const SCRIPT = /[ \t]*<script src="([^"]+)"><\/script>\n?/g;

function read(relative) {
  const file = path.join(ROOT, relative);
  if (!fs.existsSync(file)) bail(`missing ${relative}, referenced by index.html`);
  return fs.readFileSync(file, 'utf8').replace(/\s*$/, '');
}

/* A literal closing tag inside the inlined text would end the wrapper early. */
function guard(text, relative, closing) {
  if (text.toLowerCase().includes(closing)) bail(`${relative} contains "${closing}"`);
  return text;
}

function bail(message) {
  console.error('bundle failed: ' + message);
  process.exit(1);
}

let html = fs.readFileSync(SOURCE, 'utf8');
const inlined = [];

html = html.replace(STYLESHEET, (_, href) => {
  inlined.push(href);
  return `  <style>\n${guard(read(href), href, '</style')}\n  </style>\n`;
});

/* Scripts are plain (not modules) and order-dependent, so inline them in place. */
html = html.replace(SCRIPT, (_, src) => {
  inlined.push(src);
  return `  <script>\n${guard(read(src), src, '</script')}\n  </script>\n`;
});

/* Only local dependencies matter here: a relative path left behind would be a
   broken file the bundle cannot carry. An absolute http(s) link is a place the
   reader can choose to go, not something the page needs to load. */
const leftover = html.match(/(?:src|href)="(?!data:|#|https?:\/\/)[^"]+"/g);
if (leftover) bail('local reference survived: ' + leftover.join(', '));

fs.writeFileSync(OUTPUT, html);

const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
console.log(`bundled ${inlined.length} files into jungle-addition.html (${kb} KB)`);
inlined.forEach(file => console.log('  + ' + file));
