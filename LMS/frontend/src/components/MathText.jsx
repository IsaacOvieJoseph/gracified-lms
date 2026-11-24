import React from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

/**
 * MathText component renders a string that may contain LaTeX math
 * enclosed in \( ... \), \[ ... \], or dollar delimiters.
 */
const MathText = ({ text }) => {
  if (!text) return null;

  const regex = /\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\(\s*[^)]*?\\(?:frac|sqrt|pm|times|div|sum|int|alpha|beta|gamma|delta|theta|pi|phi|rho|sigma|tau|omega)[^)]*?\s*\)/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push({ text: text.slice(lastIndex, match.index) });
    parts.push({ math: match[0] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex) });

  return (
    <>
      {parts.map((part, index) => {
        if (part.text !== undefined) return <React.Fragment key={index}>{part.text}</React.Fragment>;
        const expression = part.math;
        const isDisplay = expression.startsWith('$$') || expression.startsWith('\\[');
        const delimiterLength = expression.startsWith('$$')
          || expression.startsWith('\\[')
          || expression.startsWith('\\(')
          ? 2
          : 1;
        const math = expression.slice(delimiterLength, -delimiterLength).trim();
        return isDisplay
          ? <BlockMath key={index} math={math} />
          : <InlineMath key={index} math={math} />;
      })}
    </>
  );
};

export default MathText;
