import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, ChevronUp, ChevronDown } from 'lucide-react';

interface DomSearchOverlayProps {
  containerRef: React.RefObject<HTMLElement | null>;
}

// 用于非 Monaco 的文本预览（如 Markdown 预览）：Ctrl+F 搜索并高亮 DOM 文本节点
const DomSearchOverlay: React.FC<DomSearchOverlayProps> = ({ containerRef }) => {
  const [open, setOpen] = useState(false);
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
  const inputRef = useRef<HTMLInputElement>(null);
  const marksRef = useRef<HTMLElement[]>([]);
  const timerRef = useRef<number | undefined>(undefined);

  // 注入高亮样式
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      mark.peek-dom-search { background: rgba(255, 213, 79, 0.35); color: inherit; padding: 0; border-radius: 2px; }
      mark.peek-dom-search-current { background: #ffa500; color: #000; }
    `;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  // 拦截 Ctrl+F
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        e.stopImmediatePropagation();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  // 打开时聚焦输入框
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 30);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);

  // 清除所有高亮标记，恢复原始文本
  const clearMarks = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    root.querySelectorAll('mark.peek-dom-search').forEach((m) => {
      const parent = m.parentNode;
      if (parent) {
        const text = document.createTextNode(m.textContent || '');
        parent.replaceChild(text, m);
        parent.normalize();
      }
    });
    marksRef.current = [];
  }, [containerRef]);

  const isWordChar = (ch: string | undefined) => !!ch && /[\w\u4e00-\u9fa5]/.test(ch);
  const isWholeWord = (text: string, idx: number, len: number) =>
    !isWordChar(text[idx - 1]) && !isWordChar(text[idx + len]);

  // 遍历 DOM 文本节点，高亮所有匹配
  const performSearch = useCallback(
    (q: string, cs: boolean, ww: boolean) => {
      const root = containerRef.current;
      clearMarks();
      if (!root || !q.trim()) {
        setMatchTotal(0);
        setMatchIndex(0);
        return;
      }
      const marks: HTMLElement[] = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const textNodes: Text[] = [];
      while (walker.nextNode()) {
        const t = walker.currentNode as Text;
        if (t.parentElement?.closest('mark.peek-dom-search')) continue;
        textNodes.push(t);
      }
      const needle = cs ? q : q.toLowerCase();
      for (const node of textNodes) {
        const text = node.nodeValue || '';
        if (!text) continue;
        const hay = cs ? text : text.toLowerCase();
        const parts: (string | HTMLElement)[] = [];
        let pos = 0;
        let idx = hay.indexOf(needle, pos);
        let count = 0;
        while (idx !== -1 && count < 500) {
          if (ww && !isWholeWord(text, idx, needle.length)) {
            idx = hay.indexOf(needle, idx + 1);
            continue;
          }
          if (idx > pos) parts.push(text.slice(pos, idx));
          const mark = document.createElement('mark');
          mark.className = 'peek-dom-search';
          mark.textContent = text.slice(idx, idx + needle.length);
          parts.push(mark);
          marks.push(mark);
          pos = idx + needle.length;
          idx = hay.indexOf(needle, pos);
          count++;
        }
        if (pos < text.length) parts.push(text.slice(pos));
        const hasMatch = parts.some((p) => typeof p !== 'string');
        const parent = node.parentNode;
        if (hasMatch && parent) {
          const frag = document.createDocumentFragment();
          parts.forEach((p) =>
            frag.appendChild(typeof p === 'string' ? document.createTextNode(p) : p)
          );
          parent.replaceChild(frag, node);
        }
      }
      marksRef.current = marks;
      setMatchTotal(marks.length);
      setMatchIndex(0);
    },
    [clearMarks, containerRef]
  );

  // 输入变化时防抖搜索
  useEffect(() => {
    if (!open) return;
    clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      performSearch(searchQuery, caseSensitive, wholeWord);
    }, 150);
    return () => clearTimeout(timerRef.current);
  }, [open, searchQuery, caseSensitive, wholeWord, performSearch]);

  // 当前匹配高亮 + 滚动到可视区域
  useEffect(() => {
    const marks = marksRef.current;
    marks.forEach((m, i) => {
      m.classList.toggle('peek-dom-search-current', i === matchIndex);
    });
    const cur = marks[matchIndex];
    if (cur) {
      cur.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [matchIndex, matchTotal]);

  // 关闭时清除高亮
  useEffect(() => {
    if (!open) {
      clearMarks();
      setMatchIndex(0);
      setMatchTotal(0);
    }
  }, [open, clearMarks]);

  const goNext = useCallback(() => {
    if (matchTotal <= 0) return;
    setMatchIndex((i) => (i + 1) % matchTotal);
  }, [matchTotal]);

  const goPrev = useCallback(() => {
    if (matchTotal <= 0) return;
    setMatchIndex((i) => (i - 1 + matchTotal) % matchTotal);
  }, [matchTotal]);

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
      setOpen(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed top-14 right-6 z-[100] flex items-center gap-1.5 bg-dark-surface border border-dark-border rounded-lg shadow-xl px-2 py-1.5">
      <input
        ref={inputRef}
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
        onClick={() => setOpen(false)}
        title="关闭 (Esc)"
        className="p-0.5 rounded hover:bg-dark-border text-gray-400 hover:text-gray-200"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default DomSearchOverlay;
