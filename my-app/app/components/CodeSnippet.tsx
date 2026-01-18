import { SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';

interface CodeSnippetProps {
  code: string;
  language?: string;
  title?: string;
  showLineNumbers?: boolean;
}

export default function CodeSnippet({
  code,
  language = 'python',
  title,
  showLineNumbers = true,
}: CodeSnippetProps) {
  return (
    <div className="code-snippet-container">
      {title && <div className="code-snippet-title">{title}</div>}
      <SyntaxHighlighter
        language={language}
        style={atomOneDark}
        showLineNumbers={showLineNumbers}
        customStyle={{
          margin: 0,
          borderRadius: '0 0 8px 8px',
          fontSize: '14px',
          lineHeight: '1.5',
          padding: '16px',
        }}
      >
        {code.trim()}
      </SyntaxHighlighter>
    </div>
  );
}
