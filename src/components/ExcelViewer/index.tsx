import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Loader2, AlertCircle, Grid3X3, ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { readBinaryFile } from '../../utils/fileReader';
import { getCached, setCache } from '../../utils/fileCache';

interface ExcelViewerProps {
  filePath: string;
}

interface SheetData {
  name: string;
  data: (string | number | boolean | null)[][];
}

const ExcelViewer: React.FC<ExcelViewerProps> = ({ filePath }) => {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [currentSheetIndex, setCurrentSheetIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadExcel = async () => {
      try {
        setLoading(true);
        setError(null);

        // 优先使用缓存，避免切换 tab 时重复解析
        const cacheKey = `excel:${filePath}`;
        const cached = getCached<SheetData[]>(cacheKey);
        if (cached) {
          setSheets(cached);
          setCurrentSheetIndex(0);
          setLoading(false);
          return;
        }

        const arrayBuffer = await readBinaryFile(filePath);

        // 使用 XLSX 解析
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        // 转换所有工作表
        const sheetDataList: SheetData[] = workbook.SheetNames.map((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: '',
            blankrows: false,
          }) as (string | number | boolean | null)[][];

          return {
            name: sheetName,
            data,
          };
        });

        setCache<SheetData[]>(cacheKey, sheetDataList);

        setSheets(sheetDataList);
      } catch (err) {
        console.error('Excel load error:', err);
        setError(err instanceof Error ? err.message : 'Excel 文件加载失败');
      } finally {
        setLoading(false);
      }
    };

    loadExcel();
  }, [filePath]);

  const currentSheet = sheets[currentSheetIndex];

  const handlePrevSheet = () => {
    setCurrentSheetIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleNextSheet = () => {
    setCurrentSheetIndex((prev) => Math.min(prev + 1, sheets.length - 1));
  };

  const handleSheetSelect = (index: number) => {
    setCurrentSheetIndex(index);
  };

  // 获取列字母 (A, B, C, ...)
  const getColumnLetter = (index: number): string => {
    let letter = '';
    let temp = index;
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  };

  // 加载中
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-bg">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>加载 Excel 文件中...</span>
        </div>
      </div>
    );
  }

  // 错误
  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-bg">
        <div className="text-center max-w-md">
          <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
          <h3 className="text-lg text-red-400 mb-2">Excel 文件加载失败</h3>
          <p className="text-gray-500 text-sm">{error}</p>
          <p className="text-gray-600 text-xs mt-4">提示：请确保文件是有效的 .xlsx 或 .xls 格式</p>
        </div>
      </div>
    );
  }

  // 没有数据
  if (sheets.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-bg">
        <div className="text-center">
          <Grid3X3 size={48} className="mx-auto mb-4 text-gray-600" />
          <p className="text-gray-500">Excel 文件为空</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-dark-bg">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-dark-surface border-b border-dark-border">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={16} className="text-green-400" />
          <span className="text-sm text-gray-400">Excel 表格</span>
        </div>

        {/* 工作表切换 */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevSheet}
            disabled={currentSheetIndex <= 0}
            className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-dark-border disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex items-center gap-1">
            {sheets.map((sheet, index) => (
              <button
                key={index}
                onClick={() => handleSheetSelect(index)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  index === currentSheetIndex
                    ? 'bg-green-600 text-white'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-dark-border'
                }`}
                title={sheet.name}
              >
                {sheet.name.length > 10 ? sheet.name.substring(0, 10) + '...' : sheet.name}
              </button>
            ))}
          </div>

          <button
            onClick={handleNextSheet}
            disabled={currentSheetIndex >= sheets.length - 1}
            className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-dark-border disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* 统计信息 */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>{currentSheet?.data.length || 0} 行</span>
          <span>|</span>
          <span>{currentSheet?.data[0]?.length || 0} 列</span>
        </div>
      </div>

      {/* 表格内容 */}
      <div className="flex-1 overflow-auto bg-dark-bg">
        {currentSheet && currentSheet.data.length > 0 ? (
          <table className="excel-table w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-10 bg-dark-surface border border-dark-border p-2 w-12"></th>
                {currentSheet.data[0].map((_, colIndex) => (
                  <th
                    key={colIndex}
                    className="sticky top-0 z-10 bg-dark-surface border border-dark-border p-2 text-center text-xs font-medium text-gray-400 min-w-[100px]"
                  >
                    {getColumnLetter(colIndex)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentSheet.data.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-dark-hover transition-colors">
                  <td className="sticky left-0 z-5 bg-dark-surface border border-dark-border p-2 text-center text-xs text-gray-500 w-12">
                    {rowIndex + 1}
                  </td>
                  {row.map((cell, colIndex) => (
                    <td
                      key={colIndex}
                      className={`border border-dark-border p-2 text-sm ${
                        rowIndex === 0
                          ? 'bg-dark-surface text-gray-200 font-medium'
                          : 'text-gray-400'
                      }`}
                    >
                      {cell !== null && cell !== undefined && cell !== ''
                        ? String(cell)
                        : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Grid3X3 size={48} className="mx-auto mb-4 text-gray-600" />
              <p className="text-gray-500">当前工作表为空</p>
            </div>
          </div>
        )}
      </div>

      {/* 样式 */}
      <style>{`
        .excel-table {
          border-collapse: separate;
          border-spacing: 0;
        }
        .excel-table td,
        .excel-table th {
          border: 1px solid #3a3a4a;
        }
        .excel-table tr:nth-child(even) {
          background-color: rgba(255, 255, 255, 0.02);
        }
        .excel-table tr:hover {
          background-color: rgba(255, 255, 255, 0.05);
        }
      `}</style>
    </div>
  );
};

export default ExcelViewer;
