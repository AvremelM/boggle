#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DATA = path.resolve(__dirname, '../data');

function splitFirst(str, delimiter, limit = 1) {
  const splitStr = [];
  while (splitStr.length < limit) {
    const delimiterIndex = str.indexOf(delimiter);
    if (delimiterIndex >= 0) {
      splitStr.push(str.slice(0, delimiterIndex));
      str = str.slice(delimiterIndex + delimiter.length);
    } else {
      splitStr.push(str);
      str = '';
    }
  }
  splitStr.push(str);
  return splitStr;
}

function toAnagram(word) {
  return word.split('').sort().join('');
}

async function anagrams(file, TWL) {
  const lines = readline.createInterface({
    input: fs.createReadStream(path.join(DATA, file)),
    crlfDelay: Infinity
  });

  const twl = {words: {}, anagrams: {}, total: 0};
  const csw = {words: {}, anagrams: {}, total: 0};
  for await (const line of lines) {
    const [word, s] = splitFirst(line, ' ');
    const score = Number(s);
    const anagram = toAnagram(word);

    if (TWL.has(word)) {
      twl.words[word] = score;
      twl.anagrams[anagram] = (twl.anagrams[anagram] || 0) + score;
      twl.total += score;
    }

    csw.words[word] = score;
    csw.anagrams[anagram] = (csw.anagrams[anagram] || 0) + score;
    csw.total += score;
  }

  const stats = {TWL: {}, CSW: {}};
  stats.TWL.words = percentiles(Object.values(twl.words), twl.total);
  stats.TWL.anagrams = percentiles(Object.values(twl.anagrams), twl.total);
  stats.CSW.words = percentiles(Object.values(csw.words), csw.total);
  stats.CSW.anagrams = percentiles(Object.values(csw.anagrams), csw.total);

  return {words: csw.words, stats};
}

async function buildDictionary() { 
  let lines = readline.createInterface({
    input: fs.createReadStream(path.join(DATA, 'clean_1w.txt')),
    crlfDelay: Infinity
  });

  const freqs = {};
  let total = 0;
  for await (const line of lines) {
    const [word, freq] = splitFirst(line, '\t');
    const f = Number(freq);
    total += f;
    freqs[word.toUpperCase()] = f;
  }

  lines = readline.createInterface({
    input: fs.createReadStream(path.join(DATA, 'twl.txt')),
    crlfDelay: Infinity
  });

  const twl = new Set();
  for await (const word of lines) {
    twl.add(word.toUpperCase());
  }

  const [n, o, b] = await Promise.all([
    anagrams('new4x4.txt', twl),
    anagrams('old4x4.txt', twl),
    anagrams('5x5.txt', twl)
  ]);

  lines = readline.createInterface({
    input: fs.createReadStream(path.join(DATA, 'csw.txt')),
    crlfDelay: Infinity
  });

  const dict = {};
  for await (const line of lines) {
    const [word, defn] = splitFirst(line, ' ');
    const val = {defn};

    if (freqs[word]) val.freq = freqs[word];
    if (!twl.has(word)) val.csw = true;

    if (n.words[word]) val.n = n.words[word];
    if (o.words[word]) val.o = o.words[word];
    if (b.words[word]) val.b = b.words[word];

    dict[word] = val;
  }

  const stats = {
    New: n.stats,
    Old: o.stats,
    Big: b.stats,
    freqs: percentiles(Object.values(freqs), total)
  };
  return {dict, stats};
}

function percentiles(arr, n) {
  const ptiles = [];
  arr = arr.sort((a, b) => b - a);

  let i = 1;
  let tot = 0;
  for (const v of arr) {
    if (i > 100) break;
    tot += v;
    if (tot >= i / 100 * n) {
      i++;
      ptiles.push(v);
    }
  }

  return ptiles;
}

(async () => {
  const {dict, stats} = await buildDictionary();
  fs.writeFileSync(path.join(DATA, 'dict.json'), JSON.stringify(dict));
  fs.writeFileSync(path.join(DATA, 'stats.json'), JSON.stringify(stats));
})();
