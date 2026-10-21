/**
 * export.js — 客户端导出（不依赖后端）
 * Excel: ExcelJS（免费开源，原生支持单元格样式——社区版SheetJS不支持表头底色/字体颜色，
 *        故弃用SheetJS改用ExcelJS以确保"表头加粗+冲稳保分色"真正生效）
 * PDF: jsPDF + jspdf-autotable
 * CSV: 原生实现（无外部依赖，离线可用）
 */

const ExportUtils = {

  toCSV(rows, filenameBase) {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const escape = (v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    // 加 BOM 防止 Excel 打开中文 CSV 乱码
    const bom = '\uFEFF';
    const csv = bom + [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    this.downloadBlob(blob, `${filenameBase}.csv`);
  },

  async toExcel(rows, filenameBase) {
    if (typeof ExcelJS === 'undefined') {
      alert('Excel导出库未加载，请检查网络连接（ExcelJS通过CDN引入）');
      return;
    }
    const headers = Object.keys(rows[0]);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('志愿表');

    ws.columns = headers.map(h => {
      const maxLen = Math.max(h.length, ...rows.map(r => String(r[h] ?? '').length));
      return { header: h, key: h, width: Math.min(Math.max(maxLen + 2, 8), 40) };
    });

    // 表头加粗 + 底色（ExcelJS 免费且原生支持单元格样式，社区版SheetJS不支持此能力）
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E0D5' } };

    const tierColorMap = { '冲': 'FFC0524A', '稳': 'FF4A7A6B', '保': 'FF8B8366' };
    const tierColKey = headers.includes('录取概率评估') ? '录取概率评估' : null;

    rows.forEach(r => {
      const row = ws.addRow(r);
      if (tierColKey) {
        const cell = row.getCell(tierColKey);
        const color = tierColorMap[r[tierColKey]];
        if (color) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
          cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        }
      }
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    this.downloadBlob(blob, `${filenameBase}.xlsx`);
  },

  toPDF(rows, filenameBase) {
    if (typeof window.jspdf === 'undefined') {
      alert('PDF导出库未加载，请检查网络连接（jsPDF通过CDN引入）');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    const headers = Object.keys(rows[0]);
    const body = rows.map(r => headers.map(h => String(r[h] ?? '')));

    doc.setFontSize(14);
    doc.text(filenameBase, 14, 12);

    doc.autoTable({
      head: [headers],
      body,
      startY: 18,
      styles: { fontSize: 8, font: 'helvetica' },
      headStyles: { fillColor: [43, 76, 111], textColor: 255, fontStyle: 'bold' },
      didParseCell: (data) => {
        if (data.section === 'body' && headers[data.column.index] === '录取概率评估') {
          const v = data.cell.raw;
          if (v === '冲') data.cell.styles.fillColor = [248, 232, 230];
          if (v === '稳') data.cell.styles.fillColor = [230, 238, 234];
          if (v === '保') data.cell.styles.fillColor = [239, 234, 224];
        }
      }
    });

    doc.save(`${filenameBase}.pdf`);
  },

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

if (typeof window !== 'undefined') window.ExportUtils = ExportUtils;
