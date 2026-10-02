import React from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

/**
 * MathText component renders a string that may contain LaTeX math
 * enclosed in \( ... \) for inline or \[ ... \] for block math.
 */
const MathText = ({ text }) => {
  if (!text) return null;

  // Fix common backslash escaping issues (e.g. \f being treated as form feed)
  const sanitizedText = text.replace(/\f/g, '\\f').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');

  // Regex to find \( ... \) or \[ ... \] or $$ ... $$
  const regex = /(\\\([\s\S]*?\\\))|(\\\[[\s\S]*?\\\])|(\$\$[\s\S]*?\$\$)|(\(\s*[^)]*?\\(?:frac|sqrt|pm|times|div|sum|int|alpha|beta|gamma|delta|theta|pi|phi|rho|sigma|tau|omega)[^)]*?\s*\))/g;
  
  const parts = sanitizedText.split(regex).filter(part => part !== undefined && part !== '');

  return (
    <span>
      {parts.map((part, index) => {
        // Double dollars $$ ... $$
        if (part.startsWith('$$') && part.endsWith('$$')) {
          const math = part.substring(2, part.length - 2).trim();
          return <InlineMath key={index} math={math} />;
        }
        // Escaped parens \( ... \)
        if (part.startsWith('\\(') && part.endsWith('\\)')) {
          const math = part.substring(2, part.length - 2).trim();
          return <InlineMath key={index} math={math} />;
        }
        // Escaped brackets \[ ... \]
        if (part.startsWith('\\\[') && part.endsWith('\\\]')) {
          const math = part.substring(2, part.length - 2).trim();
          return <BlockMath key={index} math={math} />;
        }
        // Fallback for ( math ) if AI messes up the backslash
        if (part.startsWith('(') && part.endsWith(')')) {
           const math = part.substring(1, part.length - 1).trim();
           // Basic cleanup for common AI mistakes (like "pm" instead of "\pm")
           const cleanedMath = math.replace(/\s+pm\s+/g, ' \\pm ')
                                   .replace(/\s*sqrt/g, ' \\sqrt');
           return <InlineMath key={index} math={cleanedMath} />;
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

export default MathText;
