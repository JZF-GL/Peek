import React, { useRef, useEffect, useState, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { X, ChevronUp, ChevronDown } from 'lucide-react';

interface CodeEditorProps {
  value: string;
  language: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ value, language, onChange, readOnly = false }) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  // ===== 搜索功能状态 =====
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [matchIndex, setMatchIndex] = useState(0);
  const [matchTotal, setMatchTotal] = useState(0);
  const [history, setHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('peek-search-history') || '[]');
    } catch {
      return [];
    }
  });
  const [historyCursor, setHistoryCursor] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const matchesRef = useRef<monaco.editor.FindMatch[]>([]);
  const decorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
  const searchTimerRef = useRef<number | undefined>(undefined);

  // 注入搜索高亮样式
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .peek-search-match { background-color: rgba(255, 213, 79, 0.22); }
      .peek-search-current { background-color: rgba(255, 165, 0, 0.45); outline: 1px solid #ffa500; }
    `;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  // 拦截 Ctrl+F，打开自定义搜索框（阻止 Monaco 原生 find）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        e.stopImmediatePropagation();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  // 打开搜索框时聚焦输入框
  useEffect(() => {
    if (searchOpen) {
      const t = setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 30);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [searchOpen]);

  // 执行搜索
  const performSearch = useCallback((query: string, cs: boolean, ww: boolean) => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model || !query.trim()) {
      matchesRef.current = [];
      setMatchTotal(0);
      setMatchIndex(0);
      return;
    }
    const matches = model.findMatches(query, true, false, cs, null, false, 10000);
    matchesRef.current = matches;
    setMatchTotal(matches.length);
    setMatchIndex(0);
  }, []);

  // 输入变化时防抖搜索
  useEffect(() => {
    if (!searchOpen) return;
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = window.setTimeout(() => {
      performSearch(searchQuery, caseSensitive, wholeWord);
    }, 150);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchQuery, caseSensitive, wholeWord, searchOpen, performSearch]);

  // 应用高亮装饰 + 跳转到当前匹配
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !searchOpen) return;
    const matches = matchesRef.current;
    const decos = matches.map((m, i) => ({
      range: m.range,
      options: { className: i === matchIndex ? 'peek-search-current' : 'peek-search-match' },
    }));
    if (decorationsRef.current) {
      decorationsRef.current.set(decos);
    } else {
      decorationsRef.current = editor.createDecorationsCollection(decos);
    }
    if (matches[matchIndex]) {
      editor.revealRangeInCenter(matches[matchIndex].range);
      editor.setSelection(matches[matchIndex].range);
    }
  }, [matchIndex, matchTotal, searchOpen]);

  // 关闭时清除装饰
  useEffect(() => {
    if (!searchOpen) {
      decorationsRef.current?.clear();
    }
  }, [searchOpen]);

  // 下一个 / 上一个
  const goNext = useCallback(() => {
    if (matchTotal <= 0) return;
    setMatchIndex((i) => (i + 1) % matchTotal);
  }, [matchTotal]);

  const goPrev = useCallback(() => {
    if (matchTotal <= 0) return;
    setMatchIndex((i) => (i - 1 + matchTotal) % matchTotal);
  }, [matchTotal]);

  // 保存搜索历史（最新在前，最多 10 条）
  const saveHistory = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setHistory((prev) => {
      const next = [trimmed, ...prev.filter((x) => x !== trimmed)].slice(0, 10);
      try {
        localStorage.setItem('peek-search-history', JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // 上下键遍历历史记录
  const handleHistoryNav = useCallback(
    (dir: 1 | -1) => {
      if (history.length === 0) return;
      let next = historyCursor + dir;
      if (next >= history.length) next = 0;
      if (next < 0) next = history.length - 1;
      setHistoryCursor(next);
      const q = history[next];
      setSearchQuery(q);
      performSearch(q, caseSensitive, wholeWord);
    },
    [history, historyCursor, caseSensitive, wholeWord, performSearch]
  );

  // 搜索输入框键盘处理
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveHistory(searchQuery);
      if (e.shiftKey) {
        goPrev();
      } else {
        goNext();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleHistoryNav(1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleHistoryNav(-1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSearchOpen(false);
      editorRef.current?.focus();
    }
  };

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
    <div className="relative h-full w-full">
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

      {/* 搜索浮层（右上角） */}
      {searchOpen && (
        <div className="absolute top-2 right-4 z-50 flex items-center gap-1.5 bg-dark-surface border border-dark-border rounded-lg shadow-xl px-2 py-1.5">
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setHistoryCursor(-1);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="查找"
            className="w-44 bg-dark-bg border border-dark-border rounded px-2 py-0.5 text-sm text-gray-200 outline-none focus:border-accent placeholder-gray-500"
          />
          <button
            title="大小写匹配 (Aa)"
            onClick={() => setCaseSensitive((v) => !v)}
            className={`px-1.5 py-0.5 rounded text-xs font-bold transition-colors ${
              caseSensitive ? 'bg-accent text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Aa
          </button>
          <button
            title="全词匹配 (ab)"
            onClick={() => setWholeWord((v) => !v)}
            className={`px-1.5 py-0.5 rounded text-xs font-bold transition-colors ${
              wholeWord ? 'bg-accent text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            ab
          </button>
          <span className="text-xs text-gray-400 min-w-[44px] text-center">
            {matchTotal > 0 ? `${matchIndex + 1}/${matchTotal}` : '0/0'}
          </span>
          <button
            onClick={goPrev}
            title="上一个 (Shift+Enter)"
            className="p-0.5 rounded hover:bg-dark-border text-gray-400 hover:text-gray-200"
          >
            <ChevronUp size={14} />
          </button>
          <button
            onClick={goNext}
            title="下一个 (Enter)"
            className="p-0.5 rounded hover:bg-dark-border text-gray-400 hover:text-gray-200"
          >
            <ChevronDown size={14} />
          </button>
          <button
            onClick={() => {
              setSearchOpen(false);
              editorRef.current?.focus();
            }}
            title="关闭 (Esc)"
            className="p-0.5 rounded hover:bg-dark-border text-gray-400 hover:text-gray-200"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default CodeEditor;
