// 将 docstream 的 AST 内容树转换为 HTML
// 用于 .doc 等旧版格式的文本预览（保留基本结构）

interface DocNode {
  type: string;
  text?: string;
  children?: DocNode[];
  formatting?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    color?: string;
    backgroundColor?: string;
    size?: string;
    font?: string;
    subscript?: boolean;
    superscript?: boolean;
  };
  metadata?: Record<string, unknown>;
}

function renderInline(node: DocNode): string {
  if (node.type === 'text') {
    let content = escapeHtml(node.text || '');
    const f = node.formatting;
    if (f) {
      if (f.bold) content = `<strong>${content}</strong>`;
      if (f.italic) content = `<em>${content}</em>`;
      if (f.underline) content = `<u>${content}</u>`;
      if (f.strikethrough) content = `<s>${content}</s>`;
      if (f.subscript) content = `<sub>${content}</sub>`;
      if (f.superscript) content = `<sup>${content}</sup>`;
      const styles: string[] = [];
      if (f.color) styles.push(`color:${f.color}`);
      if (f.backgroundColor) styles.push(`background-color:${f.backgroundColor}`);
      if (f.size) styles.push(`font-size:${f.size}`);
      if (f.font) styles.push(`font-family:${f.font}`);
      if (styles.length > 0) {
        content = `<span style="${styles.join(';')}">${content}</span>`;
      }
    }
    return content;
  }
  // 递归处理其他行内节点
  if (node.children && node.children.length > 0) {
    return node.children.map(renderInline).join('');
  }
  return escapeHtml(node.text || '');
}

function renderChildren(children: DocNode[] | undefined): string {
  if (!children || children.length === 0) return '';
  return children.map(renderNode).join('');
}

function renderNode(node: DocNode): string {
  switch (node.type) {
    case 'paragraph':
      return `<p>${renderChildren(node.children)}</p>`;
    case 'heading': {
      const level = (node.metadata as Record<string, unknown>)?.level as number || 1;
      const tag = `h${Math.min(level, 6)}`;
      return `<${tag}>${renderChildren(node.children)}</${tag}>`;
    }
    case 'text':
      return renderInline(node);
    case 'list': {
      const meta = node.metadata as Record<string, unknown> | undefined;
      const listType = meta?.listType === 'ordered' ? 'ol' : 'ul';
      return `<${listType}>${renderChildren(node.children)}</${listType}>`;
    }
    case 'table': {
      return `<table class="doc-table">${renderChildren(node.children)}</table>`;
    }
    case 'row': {
      return `<tr>${renderChildren(node.children)}</tr>`;
    }
    case 'cell': {
      const meta = node.metadata as Record<string, unknown> | undefined;
      const colSpan = (meta?.colSpan as number) || 1;
      const rowSpan = (meta?.rowSpan as number) || 1;
      const attrs = [];
      if (colSpan > 1) attrs.push(`colspan="${colSpan}"`);
      if (rowSpan > 1) attrs.push(`rowspan="${rowSpan}"`);
      return `<td ${attrs.join(' ')}>${renderChildren(node.children)}</td>`;
    }
    case 'image': {
      const meta = node.metadata as Record<string, unknown> | undefined;
      const alt = (meta?.altText as string) || '';
      return `<span class="doc-image-placeholder">[图片: ${escapeHtml(alt || '无描述')}]</span>`;
    }
    case 'page':
    case 'slide':
    case 'sheet':
      // 容器节点，直接渲染子节点
      return renderChildren(node.children);
    case 'header':
    case 'footer':
    case 'note':
      return `<div class="doc-${node.type}">${renderChildren(node.children)}</div>`;
    default:
      return `<p>${renderChildren(node.children) || escapeHtml(node.text || '')}</p>`;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 将 docstream 解析的 AST 内容节点数组转换为 HTML 字符串
 */
export function astToHtml(content: DocNode[]): string {
  if (!content || content.length === 0) return '<p class="text-gray-500">文档内容为空</p>';
  return content.map(renderNode).join('\n');
}