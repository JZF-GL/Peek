import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { useFileStore } from '../../store/useFileStore';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // 保存错误信息到本地存储
    try {
      const errors = JSON.parse(localStorage.getItem('peek-errors') || '[]');
      errors.push({
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
      });
      // 只保留最近10条错误
      localStorage.setItem('peek-errors', JSON.stringify(errors.slice(-10)));
    } catch (e) {
      console.error('Failed to save error:', e);
    }
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public handleReload = () => {
    window.location.reload();
  };

  public handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // 清理当前标签
    try {
      useFileStore.getState().setActiveTab(null);
    } catch (e) {
      console.error('Failed to reset state:', e);
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-dark-bg flex items-center justify-center p-8">
          <div className="max-w-lg w-full text-center">
            {/* 错误图标 */}
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto bg-red-900/30 rounded-full flex items-center justify-center">
                <AlertTriangle size={40} className="text-red-500" />
              </div>
            </div>

            {/* 标题 */}
            <h1 className="text-2xl font-bold text-gray-200 mb-3">
              出现问题了
            </h1>
            <p className="text-gray-400 mb-6">
              应用在处理文件时遇到了错误，但不用担心，我们可以帮您恢复。
            </p>

            {/* 错误详情 */}
            {this.state.error && (
              <div className="mb-6 p-4 bg-dark-surface rounded-lg text-left">
                <div className="text-sm text-red-400 font-mono break-all mb-2">
                  {this.state.error.message}
                </div>
                {this.state.error.stack && (
                  <details className="text-xs text-gray-500">
                    <summary className="cursor-pointer hover:text-gray-400">
                      查看详细堆栈
                    </summary>
                    <pre className="mt-2 p-2 bg-dark-bg rounded overflow-auto max-h-48">
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleGoHome}
                className="flex items-center gap-2 px-4 py-2 bg-dark-surface hover:bg-dark-hover text-gray-300 rounded-lg transition-colors"
              >
                <Home size={18} />
                <span>返回首页</span>
              </button>
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2 bg-dark-surface hover:bg-dark-hover text-gray-300 rounded-lg transition-colors"
              >
                <RefreshCw size={18} />
                <span>重试</span>
              </button>
              <button
                onClick={this.handleReload}
                className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
              >
                <RefreshCw size={18} />
                <span>刷新页面</span>
              </button>
            </div>

            {/* 提示信息 */}
            <p className="mt-6 text-xs text-gray-500">
              如果问题持续出现，请尝试重新打开应用或检查文件是否损坏。
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
