import React, { useRef, useState } from 'react';
import { Bold, Eye, Heading2, Italic, List, ListOrdered, Pencil, Quote } from 'lucide-react';
import Markdown from './Markdown';

const MarkdownEditor = ({
  value,
  onChange,
  placeholder,
  required = false,
  rows = 4,
  className = ''
}) => {
  const textareaRef = useRef(null);
  const [showPreview, setShowPreview] = useState(false);

  const applyFormatting = (format) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.slice(start, end);
    let updatedValue;
    let selectionStart;
    let selectionEnd;

    if (format.type === 'wrap') {
      const content = selectedText || 'text';
      updatedValue = `${value.slice(0, start)}${format.before}${content}${format.after}${value.slice(end)}`;
      selectionStart = start + format.before.length;
      selectionEnd = selectionStart + content.length;
    } else {
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const selectedLinesEnd = end > start ? value.indexOf('\n', end) : -1;
      const lineEnd = selectedLinesEnd === -1 ? value.length : selectedLinesEnd;
      const lineSelection = value.slice(lineStart, lineEnd);
      const lines = lineSelection.split('\n');
      const formattedLines = lines.map(line => `${format.prefix}${line}`);
      const formattedText = formattedLines.join('\n');
      updatedValue = `${value.slice(0, lineStart)}${formattedText}${value.slice(lineEnd)}`;
      selectionStart = lineStart;
      selectionEnd = lineStart + formattedText.length;
    }

    onChange(updatedValue);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  };

  const formats = [
    { label: 'Bold', icon: Bold, type: 'wrap', before: '**', after: '**' },
    { label: 'Italic', icon: Italic, type: 'wrap', before: '*', after: '*' },
    { label: 'Heading', icon: Heading2, type: 'prefix', prefix: '## ' },
    { label: 'Bulleted list', icon: List, type: 'prefix', prefix: '- ' },
    { label: 'Numbered list', icon: ListOrdered, type: 'prefix', prefix: '1. ' },
    { label: 'Quote', icon: Quote, type: 'prefix', prefix: '> ' }
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1 rounded-t-xl border border-b-0 border-gray-200 bg-gray-50 p-2 dark:border-slate-800 dark:bg-slate-950">
        {formats.map(({ label, icon: Icon, ...format }) => (
          <button
            key={label}
            type="button"
            title={label}
            aria-label={label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => applyFormatting(format)}
            className="rounded-lg p-2 text-gray-600 transition hover:bg-white hover:text-primary dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowPreview(previous => !previous)}
          className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-gray-600 transition hover:bg-white hover:text-primary dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {showPreview ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {showPreview ? 'Write' : 'Preview'}
        </button>
      </div>
      <textarea
        ref={textareaRef}
        required={required}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-b-xl border-2 border-gray-200 bg-transparent px-4 py-3 font-medium text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-primary dark:border-slate-800 dark:text-white dark:placeholder:text-slate-600 ${className}`}
      />
      {showPreview && (
        <div className="min-h-16 rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          {value.trim()
            ? <Markdown>{value}</Markdown>
            : <p className="text-sm italic text-gray-400">Nothing to preview yet.</p>}
        </div>
      )}
    </div>
  );
};

export default MarkdownEditor;
