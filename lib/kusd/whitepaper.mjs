// lib/kusd/whitepaper.mjs — reads content/kusd/WHITEPAPER.md (kept byte-for-byte as written) into blocks for
// /kusd/whitepaper. It understands only what the paper uses: one # title, a byline, ## sections, paragraphs, "- " lists,
// pipe tables, one image, and **bold**. Anything else stays a plain paragraph, so no text can be dropped.

/** "a **b** c" → [{ text: 'a ', strong: false }, { text: 'b', strong: true }, { text: ' c', strong: false }] */
export function inline(s) {
  return s.split('**').map((text, i) => ({ text, strong: i % 2 === 1 })).filter((r) => r.text !== '');
}

const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const isRule = (line) => /^\|( ?-+ ?\|)+$/.test(line.trim());

/** markdown → { title, byline, sections: [{ heading, blocks }] }; a block is p | ul | table | img */
export function parseWhitepaper(md) {
  const doc = { title: '', byline: '', sections: [] };
  const groups = md.replace(/\r\n/g, '\n').split(/\n{2,}/).map((g) => g.trim()).filter(Boolean);
  for (const g of groups) {
    const lines = g.split('\n');
    const section = doc.sections.at(-1);
    if (/^# /.test(g)) doc.title = g.slice(2).trim();
    else if (/^## /.test(g)) doc.sections.push({ heading: g.slice(3).trim(), blocks: [] });
    else if (!section) doc.byline = doc.byline ? `${doc.byline} ${g}` : g;
    else if (lines.every((l) => l.startsWith('- '))) section.blocks.push({ type: 'ul', items: lines.map((l) => inline(l.slice(2))) });
    else if (lines.length >= 2 && lines.every((l) => l.trim().startsWith('|')) && isRule(lines[1])) {
      section.blocks.push({ type: 'table', head: cells(lines[0]), rows: lines.slice(2).map(cells) });
    } else if (/^!\[[^\]]*\]\([^)]+\)$/.test(g)) {
      const [, alt, src] = g.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      section.blocks.push({ type: 'img', alt, src });
    } else section.blocks.push({ type: 'p', inline: inline(lines.join(' ')) });
  }
  return doc;
}

const flat = (runs) => runs.map((r) => r.text).join('');

/** every visible string of the parsed paper, in reading order, one per line */
export function textOf(doc) {
  const out = [doc.title, doc.byline].filter(Boolean);
  for (const s of doc.sections) {
    out.push(s.heading);
    for (const b of s.blocks) {
      if (b.type === 'p') out.push(flat(b.inline));
      else if (b.type === 'ul') out.push(...b.items.map(flat));
      else if (b.type === 'table') out.push(...[b.head, ...b.rows].map((r) => r.join(' ')));
      else if (b.type === 'img') out.push(b.alt);
    }
  }
  return out.join('\n');
}
