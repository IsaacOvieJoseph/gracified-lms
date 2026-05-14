import React from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

/**
 * MathText component renders a string that may contain LaTeX math
 * enclosed in \( ... \) for inline or \[ ... \] for block math.
 */
const MathText = ({ text }) => {
  if (!text) return null;

  // Regex to find \( ... \) or \[ ... \] or $$ ... $$
  const regex = /(\\\([\s\S]*?\\\))|(\\\[[\s\S]*?\\\])|(\$\$[\s\S]*?\$\$)/g;
  
  const parts = text.split(regex).filter(part => part !== undefined && part !== '');

  return (
    <span>
      {parts.map((part, index) => {
        if (part.startsWith('\\(') && part.endsWith('\\)')) {
          const math = part.substring(2, part.length - 2);
          return <InlineMath key={index} math={math} />;
        }
        if (part.startsWith('\\\[') && part.endsWith('\\\]')) {
          const math = part.substring(2, part.length - 2);
          return <BlockMath key={index} math={math} />;
        }
        if (part.startsWith('$$') && part.endsWith('$$')) {
          const math = part.substring(2, part.length - 2);
          return <BlockMath key={index} math={math} />;
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

export default MathText;
