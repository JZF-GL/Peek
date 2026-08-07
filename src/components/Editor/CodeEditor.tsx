import React, { useRef, useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

interface CodeEditorProps {
  value: string;
  language: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ value, language, onChange, readOnly = false }) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    try {
      // 安全配置 JSON（如果可用）
      const jsonDefaults = (monaco.languages.json as any)?.jsonDefaults;
      if (jsonDefaults) {
        jsonDefaults.setDiagnosticsOptions({
          validate: true,
          allowComments: true,
        });
      }
    } catch (e) {
      console.warn('JSON config failed:', e);
    }
  }, []);

  const handleEditorMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    
    try {
      // 设置自定义主题
      monacoInstance.editor.defineTheme('peek-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'keyword', foreground: '569cd6', fontStyle: 'bold' },
          { token: 'string', foreground: 'ce9178' },
          { token: 'number', foreground: 'b5cea8' },
          { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
          { token: 'type', foreground: '4ec9b0' },
          { token: 'class', foreground: '4ec9b0' },
          { token: 'function', foreground: 'dcdcaa' },
          { token: 'variable', foreground: '9cdcfe' },
          { token: 'constant', foreground: 'b4cea8' },
          { token: 'operator', foreground: 'd4d4d4' },
          { token: 'delimiter', foreground: 'd4d4d4' },
          { token: 'tag', foreground: '569cd6' },
          { token: 'attribute.name', foreground: '9cdcfe' },
          { token: 'attribute.value', foreground: 'ce9178' },
          { token: 'property', foreground: '9cdcfe' },
          { token: 'enum', foreground: '4ec9b0' },
          { token: 'interface', foreground: '4ec9b0' },
          { token: 'decorator', foreground: 'dcdcaa' },
          { token: 'regexp', foreground: 'd16969' },
        ],
        colors: {
          'editor.background': '#1a1a2e',
          'editor.foreground': '#d4d4d4',
          'editorLineNumber.foreground': '#858585',
          'editorLineNumber.activeForeground': '#c6c6c6',
          'editor.selectionBackground': '#264f78',
          'editor.inactiveSelectionBackground': '#3a3d41',
          'editor.findMatchBackground': '#aa0000',
          'editor.findMatchHighlightBackground': '#ffee00',
          'editor.cursorForeground': '#aeafad',
          'editor.lineHighlightBackground': '#2a2d2e',
          'editor.wordHighlightBackground': '#575757b8',
          'editor.wordHighlightStrongBackground': '#04395eaf',
          'editorIndentGuide.background': '#404040',
          'editorIndentGuide.activeBackground': '#707070',
        },
      });

      // 应用主题
      monacoInstance.editor.setTheme('peek-dark');
    } catch (e) {
      console.warn('Theme setup failed:', e);
    }

    // 设置编辑器选项
    editor.updateOptions({
      fontSize: 14,
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      wordWrap: 'on',
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      minimap: { enabled: false },
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      readOnly,
      smoothScrolling: true,
      cursorSmoothCaretAnimation: 'on',
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        indentation: true,
      },
    });
  };

  // 获取正确的语言 ID
  const getLanguageId = (lang: string): string => {
    const languageMap: Record<string, string> = {
      'javascript': 'javascript',
      'typescript': 'typescript',
      'jsx': 'javascript',
      'tsx': 'typescript',
      'python': 'python',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'csharp': 'csharp',
      'go': 'go',
      'rust': 'rust',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'yaml': 'yaml',
      'xml': 'xml',
      'markdown': 'markdown',
      'sql': 'sql',
      'shell': 'shell',
      'bash': 'shell',
      'php': 'php',
      'ruby': 'ruby',
      'swift': 'swift',
      'kotlin': 'kotlin',
      'vue': 'html', // Monaco 可能不支持 Vue 专用语法，使用 html
    };
    
    return languageMap[lang.toLowerCase()] || 'plaintext';
  };

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        defaultLanguage={getLanguageId(language)}
        language={getLanguageId(language)}
        value={value}
        theme="vs-dark"
        onChange={(newValue) => onChange(newValue || '')}
        onMount={handleEditorMount}
        options={{
          readOnly,
          fontSize: 14,
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
          wordWrap: 'on',
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          minimap: { enabled: false },
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
        }}
        loading={
          <div className="h-full w-full flex items-center justify-center bg-dark-bg">
            <div className="flex items-center gap-2 text-gray-500">
              <div className="w-4 h-4 border-2 border-gray-600 border-t-accent rounded-full animate-spin" />
              <span>加载编辑器...</span>
            </div>
          </div>
        }
      />
    </div>
  );
};

export default CodeEditor;
