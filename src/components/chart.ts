import { escapeHtml as html } from '../utils/html';
import { decimal } from './layout';

export interface ChartSeries {
  label: string;
  color: string;
  values: (number | null)[];
  provisional?: boolean[];
  dashed?: boolean;
}
/** Native SVG with explicit gaps; the accompanying table provides exact values. */
export function lineChart(title: string, dates: string[], series: ChartSeries[], unit: string, includeZero = false): string {
  const values = series.flatMap((line) => line.values.filter((value): value is number => value !== null));
  if (!values.length) return `<div class="chart-empty"><strong>暂时没有${html(title)}数据</strong><p>添加记录后，这里会显示趋势。缺失日期不会补零。</p></div>`;
  let min = Math.min(...values, ...(includeZero ? [0] : []));
  let max = Math.max(...values, ...(includeZero ? [0] : []));
  const padding = Math.max((max - min) * 0.12, unit === 'kg' ? 0.5 : 50);
  min = includeZero && min === 0 ? 0 : min - padding;
  max += padding;
  const left = 58, right = 700, top = 22, bottom = 206;
  const x = (index: number) => left + index * (right - left) / Math.max(dates.length - 1, 1);
  const y = (value: number) => bottom - (value - min) / (max - min) * (bottom - top);
  const grid = [0, 0.5, 1].map((ratio) => {
    const value = min + (max - min) * ratio;
    return `<line x1="${left}" y1="${y(value)}" x2="${right}" y2="${y(value)}" stroke="#39464a"/><text x="${left - 9}" y="${y(value) + 4}" text-anchor="end">${decimal(value)}</text>`;
  }).join('');
  const paths = series.map((line) => {
    let path = '';
    let connected = false;
    line.values.forEach((value, index) => {
      if (value === null || line.provisional?.[index]) { connected = false; return; }
      path += `${connected ? 'L' : 'M'}${x(index)},${y(value)} `;
      connected = true;
    });
    const dots = line.values.map((value, index) => value === null ? '' : `<circle cx="${x(index)}" cy="${y(value)}" r="${line.provisional?.[index] ? 4 : 3}" fill="${line.provisional?.[index] ? 'white' : line.color}" stroke="${line.color}" stroke-width="2"><title>${html(dates[index]!)} · ${html(line.label)} ${decimal(value)} ${html(unit)}${line.provisional?.[index] ? '（记录中）' : ''}</title></circle>`).join('');
    return `<path d="${path}" fill="none" stroke="${line.color}" stroke-width="2" ${line.dashed ? 'stroke-dasharray="6 5"' : ''}/>${dots}`;
  }).join('');
  const zero = min < 0 && max > 0 ? `<line x1="${left}" x2="${right}" y1="${y(0)}" y2="${y(0)}" stroke="#8d9a98" stroke-dasharray="3 4"/>` : '';
  return `<div class="chart-wrap"><svg viewBox="0 0 720 248" role="img" aria-label="${html(title)}趋势，单位 ${html(unit)}。精确值见下方每日明细。"><title>${html(title)}趋势</title>${grid}${zero}${paths}<text x="${left}" y="239">${html(dates[0]!.slice(5))}</text><text x="${right}" y="239" text-anchor="end">${html(dates.at(-1)!.slice(5))}</text></svg></div>
    <div class="chart-legend">${series.map((line) => `<span><i style="background:${line.color}"></i>${html(line.label)}</span>`).join('')}</div>`;
}
