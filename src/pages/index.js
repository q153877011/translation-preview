import Head from "next/head";
import React, { useState } from "react";

// 简单csv解析器，支持引号包裹字段、字段内换行和逗号
function parseCSV(str) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < str.length) {
    const char = str[i];
    if (inQuotes) {
      if (char === '"') {
        if (str[i + 1] === '"') { // 转义双引号
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (char === '\r') {
        // 跳过，兼容\r\n
      } else {
        field += char;
      }
    }
    i++;
  }
  // 处理最后一行
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
}

// html转义函数
function escapeHTML(str) {
  return str.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default function Home() {
  const [tables, setTables] = useState([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState({ tableIdx: null, rowIdx: null, colIdx: null });
  const [editValue, setEditValue] = useState("");

  // 剪贴板读取并渲染
  const handlePaste = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        const text = await navigator.clipboard.readText();
        if (!text.trim()) {
          setError('剪贴板内容为空');
          setTables([]);
          return;
        }
        const tableStrs = text.split('--,,--');
        const parsedTables = tableStrs.map(tableStr => parseCSV(tableStr.trim())).filter(t => t.length > 0);
        setTables(parsedTables);
        setError('');
      } catch (e) {
        setError('读取剪贴板失败');
        setTables([]);
      }
    } else {
      setError('当前浏览器不支持剪贴板API');
      setTables([]);
    }
  };

  // 进入编辑状态
  const handleCellDoubleClick = (tableIdx, rowIdx, colIdx, value) => {
    setEditing({ tableIdx, rowIdx, colIdx });
    setEditValue(value);
  };

  // 保存编辑
  const handleEditSave = () => {
    if (editing.tableIdx === null) return;
    setTables(prevTables => {
      const newTables = prevTables.map((table, tIdx) =>
        tIdx !== editing.tableIdx ? table :
          table.map((row, rIdx) =>
            rIdx !== editing.rowIdx ? row :
              row.map((cell, cIdx) =>
                cIdx !== editing.colIdx ? cell : editValue
              )
          )
      );
      return newTables;
    });
    setEditing({ tableIdx: null, rowIdx: null, colIdx: null });
    setEditValue("");
  };

  // 处理输入框事件
  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleEditSave();
    } else if (e.key === 'Escape') {
      setEditing({ tableIdx: null, rowIdx: null, colIdx: null });
      setEditValue("");
    }
  };

  // 导出为csv
  const handleExport = () => {
    // 单元格内容转csv，处理逗号、换行、引号
    const toCsvRow = row => row.map(cell => {
      if (cell == null) return '';
      const str = String(cell);
      if (str.includes('"')) {
        // 双引号转义
        return '"' + str.replace(/"/g, '""') + '"';
      } else if (str.includes(',') || str.includes('\n')) {
        return '"' + str + '"';
      } else {
        return str;
      }
    }).join(',');
    // 多表格合并
    const csvString = tables.map(table => table.map(toCsvRow).join('\n')).join('\n--,,--\n');
    // 下载
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <div style={{padding: '32px', fontFamily: 'sans-serif'}}>
        <h1>CSV 多表格渲染</h1>
        <button onClick={handlePaste} style={{marginBottom: 16, padding: '6px 16px', fontSize: 16}}>从剪贴板粘贴并渲染</button>
        <button onClick={handleExport} style={{marginLeft: 12, marginBottom: 16, padding: '6px 16px', fontSize: 16}}>导出为CSV</button>
        {error && <div style={{color:'#888', margin:'20px 0'}}>{error}</div>}
        {tables.map((data, tableIdx) => (
          <table key={tableIdx} style={{ borderCollapse: 'collapse', margin: '24px 0', width: '100%' }}>
            <thead>
              <tr>
                {data[0].map((cell, colIdx) => (
                  <th key={colIdx} style={{ border: '1px solid #ccc', padding: '8px 12px', textAlign: 'left', background: '#f5f5f5', fontWeight: 'bold' }}>{cell}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(1).map((row, rIdx) => (
                <tr key={rIdx} style={{ background: rIdx % 2 === 1 ? '#fafafa' : undefined }}>
                  {row.map((cell, cIdx) => {
                    const realRowIdx = rIdx + 1; // 因为data.slice(1)
                    const isEditing = editing.tableIdx === tableIdx && editing.rowIdx === realRowIdx && editing.colIdx === cIdx;
                    return (
                      <td
                        key={cIdx}
                        style={{ border: '1px solid #ccc', padding: '8px 12px', textAlign: 'left', cursor: 'pointer' }}
                        onDoubleClick={() => handleCellDoubleClick(tableIdx, realRowIdx, cIdx, cell)}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={handleEditSave}
                            onKeyDown={handleEditKeyDown}
                            style={{ width: '100%', fontFamily: 'inherit', fontSize: 14, padding: 2, boxSizing: 'border-box' }}
                          />
                        ) : (
                          <pre style={{margin:0, fontFamily:'inherit', whiteSpace:'pre-wrap'}}>{cell}</pre>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </>
  );
}
