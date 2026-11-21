// Mobile QuickJS hosts do not provide TextDecoder. Keep lyric decoding local.
export function decodeUTF8(bytes, fatal = false) {
  let text = '';
  const invalid = () => {
    if (fatal) throw new TypeError('Invalid UTF-8 lyrics');
    text += '\uFFFD';
  };
  for (let i = 0; i < bytes.length;) {
    const first = bytes[i++];
    if (first < 0x80) { text += String.fromCharCode(first); continue; }
    const count = first >= 0xc2 && first <= 0xdf ? 1 : first >= 0xe0 && first <= 0xef ? 2 : first >= 0xf0 && first <= 0xf4 ? 3 : 0;
    if (!count) { invalid(); continue; }
    let value = first & (0x7f >> count), valid = true;
    for (let part = 0; part < count; part++) {
      const next = bytes[i];
      const lower = !part && first === 0xe0 ? 0xa0 : !part && first === 0xf0 ? 0x90 : 0x80;
      const upper = !part && first === 0xed ? 0x9f : !part && first === 0xf4 ? 0x8f : 0xbf;
      if (next == null || next < lower || next > upper) { valid = false; break; }
      i++;
      value = (value << 6) | (next & 0x3f);
    }
    if (valid) text += String.fromCodePoint(value);
    else invalid();
  }
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
