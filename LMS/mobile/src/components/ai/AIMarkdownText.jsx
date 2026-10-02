import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

/**
 * Lightweight Markdown renderer for the Gracy AI tutor chat bubble.
 * Renders the commonly-produced constructs (headings, bold, italic,
 * inline code, fenced code blocks, lists, blockquote, tables) using
 * native nested <Text> elements so they appear formatted instead of raw.
 */
export default function AIMarkdownText({ text, theme, style }) {
  if (text == null) return null;

  const base = {
    color: theme.text,
    fontSize: 14,
    lineHeight: 20,
  };

  // ---- inline parsing -------------------------------------------------------
  const renderInline = (str, keyPrefix) => {
    const nodes = [];
    const tokenRe = /(\*\*\*[^*]+?\*\*\*|\*\*[^*]+?\*\*|__[^_]+?__|\*[^*]+?\*|_`[^`]+?`_|`[^`]+?`)/g;
    let last = 0;
    let m;
    let k = 0;
    while ((m = tokenRe.exec(str)) !== null) {
      if (m.index > last) {
        nodes.push(<Text key={`${keyPrefix}_p${k++}`} style={base}>{str.slice(last, m.index)}</Text>);
      }
      const tok = m[0];
      let innerStyle = {};
      let inner = tok;
      if (tok.startsWith('***') && tok.endsWith('***')) {
        inner = tok.slice(3, -3);
        innerStyle = { fontWeight: '800', fontStyle: 'italic' };
      } else if ((tok.startsWith('**') && tok.endsWith('**')) || (tok.startsWith('__') && tok.endsWith('__'))) {
        inner = tok.slice(2, -2);
        innerStyle = { fontWeight: '800' };
      } else if (tok.startsWith('```') || tok.startsWith('`')) {
        inner = tok.replace(/^`+|`+$/g, '');
        innerStyle = { fontFamily: 'monospace', backgroundColor: theme.surfaceElevated, paddingHorizontal: 4, borderRadius: 4, color: theme.primary };
      } else if ((tok.startsWith('*') && tok.endsWith('*')) || (tok.startsWith('_') && tok.endsWith('_'))) {
        inner = tok.slice(1, -1);
        innerStyle = { fontStyle: 'italic' };
      }
      nodes.push(<Text key={`${keyPrefix}_t${k++}`} style={[base, innerStyle]}>{inner}</Text>);
      last = m.index + m[0].length;
    }
    if (last < str.length) {
      nodes.push(<Text key={`${keyPrefix}_e${k++}`} style={base}>{str.slice(last)}</Text>);
    }
    return nodes;
  };

  const source = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = source.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
      const line = lines[i];

      // fenced code block
      if (/^```/.test(line)) {
        const code = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) {
          code.push(lines[i]);
          i++;
        }
        i++;
        out.push(
          <View key={`code${out.length}`} style={[styles.codeBlock, { backgroundColor: theme.surfaceElevated }]}>
            <Text style={[styles.codeText, { color: theme.text }]}>{code.join('\n')}</Text>
          </View>
        );
        continue;
      }

      // heading
      let h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        const level = h[1].length;
        const size = level === 1 ? 19 : level === 2 ? 17 : level === 3 ? 15 : 14;
        out.push(
          <Text key={`h${out.length}`} style={[base, { fontWeight: '800', fontSize: size, marginTop: level <= 2 ? 6 : 2, marginBottom: 2 }]}>
            {renderInline(h[2], `h${out.length}`)}
          </Text>
        );
        i++;
        continue;
      }

      // table
      const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
      if (isTableRow(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        const rows = [];
        while (i < lines.length && isTableRow(lines[i])) {
          rows.push(lines[i].replace(/^\s*\||\|\s*$/g, '').split('|').map((c) => c.trim()));
          i++;
        }
        const header = rows[0] || [];
        const body = rows.slice(2);
        out.push(
          <Text key={`th${out.length}`} style={[base, { fontWeight: '800', marginTop: 2 }]}>
            {header.join('  |  ')}
          </Text>
        );
        body.forEach((row) => {
          out.push(
            <Text key={`trow${out.length}`} style={[base, { paddingLeft: 4 }]}>
              {row.join('  |  ')}
            </Text>
          );
        });
        continue;
      }

      // unordered / ordered list — preserve lines
      const listMatch = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
      if (listMatch) {
        const marker = /^\d/.test(listMatch[1]) ? `${/^(\d+)/.exec(listMatch[1])[1]}.` : '•';
        out.push(
          <Text key={`l${out.length}`} style={[base, { paddingLeft: 6 }]}>
            <Text style={[base, { color: theme.primary, fontWeight: '800', marginRight: 6 }]}>{marker}  </Text>
            {renderInline(listMatch[2], `li${out.length}`)}
          </Text>
        );
        i++;
        continue;
      }

      // blockquote
      if (/^>\s?/.test(line)) {
        out.push(
          <Text key={`q${out.length}`} style={[base, { fontStyle: 'italic', color: theme.muted, borderLeftWidth: 3, borderLeftColor: theme.primary, paddingLeft: 8 }]}>
            {renderInline(line.replace(/^>\s?/, ''), `q${out.length}`)}
          </Text>
        );
        i++;
        continue;
      }

      // horizontal rule
      if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
        out.push(<View key={`hr${out.length}`} style={[styles.hr, { backgroundColor: theme.border }]} />);
        i++;
        continue;
      }

      // blank line
      if (line.trim() === '') {
        i++;
        continue;
      }

      // paragraph — collect consecutive non-empty non-special lines
      const para = [line];
      i++;
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !/^(#{1,6})\s/.test(lines[i]) &&
        !/^```/.test(lines[i]) &&
        !/^\s*([-*+]|\d+[.)])\s/.test(lines[i]) &&
        !/^\s*\|.*\|\s*$/.test(lines[i]) &&
        !/^\s*([-*_])\1{2,}\s*$/.test(lines[i])
      ) {
        para.push(lines[i]);
        i++;
      }
      out.push(
        <Text key={`p${out.length}`} style={[base, { marginVertical: 2 }]}>
          {renderInline(para.join(' '), `p${out.length}`)}
        </Text>
      );
    }

  return <Text style={[style, { width: '100%' }]}>{out}</Text>;
}
const styles = StyleSheet.create({
  codeBlock: {
    borderRadius: 8,
    padding: 10,
    marginVertical: 4,
    overflow: 'hidden',
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 12.5,
    lineHeight: 18,
  },
  hr: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
  },
});
