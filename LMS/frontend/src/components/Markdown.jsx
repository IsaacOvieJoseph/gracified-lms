import React from 'react';
import MathText from './MathText';

const cls = {
  p: 'mb-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300',
  h1: 'mb-2 mt-4 text-lg font-black text-slate-900 dark:text-white',
  h2: 'mb-2 mt-4 text-base font-black text-slate-900 dark:text-white',
  h3: 'mb-2 mt-3 text-sm font-black text-slate-900 dark:text-white',
  h4: 'mb-2 mt-3 text-sm font-bold text-slate-900 dark:text-white',
  h5: 'mb-1 mt-3 text-sm font-bold text-slate-800 dark:text-slate-200',
  h6: 'mb-1 mt-3 text-xs font-black uppercase tracking-wide text-slate-600 dark:text-slate-400',
  ul: 'mb-3 space-y-1 pl-5 list-disc marker:text-slate-400',
  ol: 'mb-3 space-y-1 pl-5 list-decimal marker:text-slate-400',
  li: 'text-sm leading-relaxed text-slate-700 dark:text-slate-300',
  blockquote: 'mb-3 border-l-4 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 rounded-r-lg px-4 py-2 text-sm italic text-slate-600 dark:text-slate-300',
  code: 'px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[12px] font-mono text-rose-600 dark:text-rose-400',
  pre: 'mb-3 overflow-x-auto rounded-xl bg-slate-900 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 text-[12px] font-mono text-slate-100 leading-relaxed',
  hr: 'my-4 border-t-2 border-dashed border-slate-200 dark:border-slate-800',
  table: 'mb-3 w-full border-collapse overflow-hidden rounded-xl text-sm',
  th: 'border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 px-3 py-2 text-left text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200',
  td: 'border border-slate-200 dark:border-slate-800 px-3 py-2 align-top text-slate-700 dark:text-slate-300',
  strong: 'font-bold text-slate-900 dark:text-white',
  em: 'italic',
  del: 'line-through text-slate-400',
  a: 'text-violet-600 dark:text-violet-400 underline underline-offset-2 decoration-violet-300 dark:decoration-violet-700 hover:text-violet-800 dark:hover:text-violet-300 transition-colors',
};

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const Text = ({ children, inline }) => {
  const content = String(children);
  const tokens = [];
  let out = content;
  const patterns = [
    { test: /^!\[([^\]]*)\]\(([^)]+)\)/, type: 'img' },
    { test: /^\[([^\]]+)\]\(([^)]+)\)/, type: 'link' },
    { test: /^`([^`]+)`/, type: 'code' },
    { test: /^\*\*\*([^*]+)\*\*\*|^___([^_]+)___/, type: 'bolditalic' },
    { test: /^\*\*([^*]+)\*\*|^__([^_]+)__/, type: 'strong' },
    { test: /^\*([^*]+)\*|^_([^_]+)_/, type: 'em' },
    { test: /^~~([^~]+)~~/, type: 'del' },
  ];

  const next = (re, type) => {
    const m = out.match(re);
    if (!m) return false;
    const before = out.slice(0, m.index);
    if (before) tokens.push(before);
    const value = (m[1] || m[2] || '');
    const extra = m.slice(2);
    tokens.push({ type, value, extra });
    out = out.slice(m.index + m[0].length);
    return true;
  };

  while (out.length) {
    let matched = false;
    for (const p of patterns) {
      if (next(p.test, p.type)) { matched = true; break; }
    }
    if (matched) continue;
    tokens.push(out.slice(0, 1));
    out = out.slice(1);
  }

  const renderToken = (t, i) => {
    if (typeof t === 'string') return <MathText key={i} text={escapeHtml(t)} />;
    switch (t.type) {
      case 'strong': return <strong key={i} className={cls.strong}><Text>{t.value}</Text></strong>;
      case 'bolditalic': return <strong key={i} className={cls.strong}><em className={cls.em}><Text>{t.value}</Text></em></strong>;
      case 'em': return <em key={i} className={cls.em}><Text>{t.value}</Text></em>;
      case 'del': return <del key={i} className={cls.del}><Text>{t.value}</Text></del>;
      case 'code': return <code key={i} className={cls.code}>{escapeHtml(t.value)}</code>;
      case 'link': return <a key={i} href={t.extra?.[0]} target="_blank" rel="noreferrer" className={cls.a}><Text>{t.value}</Text>{t.extra?.[0] && <span className="ml-0.5 text-[10px]">↗</span>}</a>;
      case 'img': return <img key={i} src={t.extra?.[0]} alt={t.value} className="my-2 max-w-full rounded-xl" />;
      default: return null;
    }
  };

  if (inline) return <>{tokens.map(renderToken)}</>;
  return tokens.map(renderToken);
};

const parseInline = (line, key) => <Text inline key={key}>{line}</Text>;

const Markdown = ({ children }) => {
  if (children == null) return null;
  const source = String(children).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = source.split('\n');
  const blocks = [];
  let i = 0;

  const push = (type, props, key) => blocks.push({ type, props, key });

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      const codeLines = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { codeLines.push(lines[i]); i++; }
      i++;
      push('pre', { text: codeLines.join('\n') }, blocks.length);
      continue;
    }

    let m = line.match(/^(#{1,6})\s+(.*)$/);
    if (m) {
      push('heading', { level: m[1].length, text: m[2] }, blocks.length);
      i++;
      continue;
    }

    if (/^\|.*\|[ \t]*$/.test(line) && i + 1 < lines.length && /^[\s|:-\s|]+\|/.test(lines[i + 1])) {
      const tbl = [];
      while (i < lines.length && /^\|.*\|[ \t]*$/.test(lines[i])) tbl.push(lines[i]);
      const parseRow = (row) => row.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const header = parseRow(tbl[0]);
      const body = tbl.slice(2).map(parseRow);
      push('table', { header, body }, blocks.length);
      i = tbl.length > 0 ? i + tbl.length : i + 1;
      continue;
    }

    if (/^([-*+])\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
      const list = [];
      const ordered = /^\d+[.)]\s+/.test(line);
      while (i < lines.length && (/^([-*+])\s+/.test(lines[i]) || /^\d+[.)]\s+/.test(lines[i]))) {
        const clean = lines[i].replace(/^([-*+]|\d+[.)])\s+/, '');
        list.push(clean);
        i++;
      }
      push('list', { ordered, items: list }, blocks.length);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { quote.push(lines[i].replace(/^>\s?/, '')); i++; }
      push('blockquote', { text: quote.join('\n') }, blocks.length);
      continue;
    }

    if (/^([-*_])\1{2,}\s*$/.test(line)) {
      push('hr', {}, blocks.length);
      i++;
      continue;
    }

    if (line.trim() === '') { i++; continue; }

    const para = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,6})\s/.test(lines[i]) && !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i]) && !/^```/.test(lines[i]) && !/^(#{1,6})\s/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    push('p', { text: para.join(' ') }, blocks.length);
  }

  return (
    <div className="text-slate-700 dark:text-slate-300">
      {blocks.map((b) => {
        switch (b.type) {
          case 'heading': {
            const H = `h${b.props.level}`;
            return <H key={b.key} className={cls[`h${b.props.level}`]}>{parseInline(b.props.text, 't')}</H>;
          }
          case 'p': return <p key={b.key} className={cls.p}>{parseInline(b.props.text, 't')}</p>;
          case 'list':
            if (b.props.ordered) {
              return <ol key={b.key} className={cls.ol}>{b.props.items.map((it, k) => <li key={k} className={cls.li}><Text>{it}</Text></li>)}</ol>;
            }
            return <ul key={b.key} className={cls.ul}>{b.props.items.map((it, k) => <li key={k} className={cls.li}><Text>{it}</Text></li>)}</ul>;
          case 'blockquote': return <blockquote key={b.key} className={cls.blockquote}><Markdown>{b.props.text}</Markdown></blockquote>;
          case 'hr': return <hr key={b.key} className={cls.hr} />;
          case 'pre': return <pre key={b.key} className={cls.pre}><code>{escapeHtml(b.props.text)}</code></pre>;
          case 'table':
            return (
              <div key={b.key} className="mb-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>{b.props.header.map((h, k) => <th key={k} className={cls.th}>{parseInline(h, 'h')}</th>)}</tr>
                  </thead>
                  <tbody>
                    {b.props.body.map((row, k) => (
                      <tr key={k} className="odd:bg-white dark:odd:bg-slate-900 even:bg-slate-50 dark:even:bg-slate-800/40">
                        {row.map((c, j) => <td key={j} className={cls.td}>{parseInline(c, 'd')}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default: return null;
        }
      })}
    </div>
  );
};

export default Markdown;
