import { Component, ElementRef, ViewChild, Renderer2 } from '@angular/core';
import Chart from 'chart.js/auto';
import * as XLSX from 'xlsx';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(zoomPlugin);

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  template: `
    <button 
      (click)="importExcel()" 
      style="position: fixed; top: 10px; left: 10px; z-index: 1000; height: 40px;">
      Import Excel
    </button>

    <div 
      #chartContainer 
      style="
        margin-top: 60px;
        width: 100%;
        height: calc(100vh - 60px);
        display: flex;
        flex-direction: column; /* Normal top-to-bottom scrolling */
        overflow-y: auto;
        padding: 20px;
      ">
    </div>
  `
})
export class BarChartComponent {
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;

  private charts: Chart[] = [];
  private isSyncing = false;

  constructor(private renderer: Renderer2) {}

  importExcel() {
    const input = this.renderer.createElement('input');
    input.type = 'file';
    input.accept = '.xls, .xlsx';

    input.addEventListener('change', (event: any) => {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e: any) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const transactions = jsonData.slice(10).map(row => {
          const type = (row[6] || '').toString().trim().toUpperCase();
          const rawAmount = Number(row[7]);
          return {
            date: row[2],
            type,
            amount: type === 'DR' ? -rawAmount : rawAmount
          };
        }).filter(entry =>
          entry.date &&
          !isNaN(Date.parse(entry.date)) &&
          !isNaN(entry.amount)
        );

        if (transactions.length === 0) {
          alert('No valid transactions found.');
          return;
        }

        transactions.sort((a, b) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        const labels = transactions.map(entry =>
          new Date(entry.date).toLocaleDateString()
        );
        const amounts = transactions.map(entry => entry.amount);
        const backgroundColors = amounts.map(amount =>
          amount >= 0 ? 'rgba(0, 200, 0, 0.7)' : 'rgba(255, 0, 0, 0.7)'
        );
        const borderColors = amounts.map(amount =>
          amount >= 0 ? 'rgba(0, 150, 0, 1)' : 'rgba(200, 0, 0, 1)'
        );

        this.renderNewChart(labels, amounts, backgroundColors, borderColors);
      };

      reader.readAsArrayBuffer(file);
    });

    input.click();
  }

  renderNewChart(labels: string[], data: number[], backgroundColors: string[], borderColors: string[]) {
    const chartWrapper = this.renderer.createElement('div');
    chartWrapper.style.marginBottom = '30px';
    chartWrapper.style.width = '100%';

    const canvas = this.renderer.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.maxWidth = '100%';
    canvas.style.height = '300px';

    this.renderer.appendChild(chartWrapper, canvas);
    this.renderer.appendChild(this.chartContainer.nativeElement, chartWrapper);

    const newChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Transaction Amount',
          data,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          zoom: {
            zoom: {
              wheel: { enabled: true },
              pinch: { enabled: true },
              mode: 'x',
              onZoom: ({ chart }) => this.syncZoom(chart)
            },
            pan: {
              enabled: true,
              mode: 'x',
              onPan: ({ chart }) => this.syncZoom(chart)
            }
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            title: {
              display: true,
              text: 'Amount'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Date'
            },
            ticks: {
              maxRotation: 90,
              minRotation: 9000
            }
          }
        }
      }
    });

    this.charts.push(newChart);
  }

  syncZoom(sourceChart: Chart) {
    if (this.isSyncing) return;
    this.isSyncing = true;

    const sourceXAxis = sourceChart.scales['x'];
    const min = sourceXAxis.min;
    const max = sourceXAxis.max;

    for (const chart of this.charts) {
      if (chart === sourceChart) continue;

      if (chart.options.scales?.['x']) {
        chart.options.scales['x'].min = min;
        chart.options.scales['x'].max = max;
        chart.update('none');
      }
    }

    this.isSyncing = false;
  }
}
