// Professional PowerPoint Export with All Charts and KPIs
// Creates proper PPTX file using JSZip to manually construct PowerPoint structure

import JSZip from 'jszip';
import type { CityInstallationData } from '@/data/cityData';

// Extended interface to support PhaseProgress with timeline
interface PhaseProgress {
  actual: number;
  planned: number;
  timeline?: {
    month: string;
    actual: number;
    planned: number;
  }[];
}

interface ExtendedCityInstallationData {
  surveys: number | PhaseProgress;
  foundations: number | PhaseProgress;
  cabinet: number | PhaseProgress;
  cable: number | PhaseProgress;
  controlRoom: number | PhaseProgress;
  ppic3: number | PhaseProgress;
  overall: number;
  timeline?: {
    month: string;
    surveys: number;
    foundations: number;
    cabinet: number;
    cable: number;
    controlRoom: number;
    ppic3: number;
    overall: number;
  }[];
}

interface ExportData {
  cityName: string;
  cityData: ExtendedCityInstallationData;
  installationPhases: {
    key: string;
    title: string;
    percentage: number;
  }[];
}

const COLORS = ['#4472C4', '#70AD47', '#FFC000', '#ED7D31', '#C00000', '#FFD966'];

// Icon SVG paths for each phase type
const ICON_PATHS: Record<string, string> = {
  surveys: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', // ClipboardCheck
  foundations: 'M3.75 21h16.5M4.5 3h15m-15 0v18m15-18v18M9 6.75h6m-6 3h6m-6 3h6', // Building2
  cabinet: 'M6.827 6.175a2.31 2.31 0 011.826 0l5.347 2.09a2.31 2.31 0 001.826 0V12a2.31 2.31 0 01-1.826 0l-5.347-2.09a2.31 2.31 0 00-1.826 0V6.175z M12 6.5v5.5', // Camera
  cable: 'M13 10V3L4 14h7v7l9-11h-7z', // Zap
  controlRoom: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25', // Home
  ppic3: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z', // Radio
};

// Convert image data URL to base64
function dataURLToBase64(dataURL: string): string {
  return dataURL.split(',')[1];
}

// Phase colors matching the dashboard
const PHASE_COLORS: Record<string, string> = {
  surveys: '#3b82f6',
  foundations: '#10b981',
  cabinet: '#f59e0b',
  cable: '#a855f7',
  controlRoom: '#ef4444',
  ppic3: '#eab308',
};

// Create chart images as base64
async function createChartImage(type: string, data: any, title: string): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 700;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Title
  ctx.fillStyle = '#2C3E50';
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(title, canvas.width / 2, 50);

  if (type === 'bar') {
    const chartArea = { x: 100, y: 120, width: 1000, height: 520 };
    const maxValue = Math.max(...data.map((d: any) => d.value));
    const barWidth = 120;
    const spacing = (chartArea.width - (data.length * barWidth)) / (data.length + 1);

    // Grid
    ctx.strokeStyle = '#E8E8E8';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = chartArea.y + (chartArea.height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(chartArea.x, y);
      ctx.lineTo(chartArea.x + chartArea.width, y);
      ctx.stroke();
    }

    // Bars
    data.forEach((item: any, index: number) => {
      const barHeight = (item.value / maxValue) * chartArea.height;
      const x = chartArea.x + spacing + index * (barWidth + spacing);
      const y = chartArea.y + chartArea.height - barHeight;

      const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
      gradient.addColorStop(0, COLORS[index % COLORS.length]);
      gradient.addColorStop(1, COLORS[index % COLORS.length] + 'DD');
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);

      ctx.fillStyle = '#2C3E50';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${item.value}%`, x + barWidth / 2, y - 15);

      ctx.fillStyle = '#666666';
      ctx.font = '16px Arial';
      const label = item.label.length > 18 ? item.label.substring(0, 15) + '...' : item.label;
      ctx.fillText(label, x + barWidth / 2, chartArea.y + chartArea.height + 35);
    });

    // Axes
    ctx.strokeStyle = '#CCCCCC';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(chartArea.x, chartArea.y);
    ctx.lineTo(chartArea.x, chartArea.y + chartArea.height);
    ctx.lineTo(chartArea.x + chartArea.width, chartArea.y + chartArea.height);
    ctx.stroke();
  }

  if (type === 'pie') {
    const centerX = 500;
    const centerY = 400;
    const outerRadius = 250;
    const innerRadius = 150;
    let currentAngle = -Math.PI / 2;
    const total = data.reduce((sum: number, d: any) => sum + d.value, 0);

    data.forEach((item: any, index: number) => {
      const sliceAngle = (item.value / total) * 2 * Math.PI;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;

      ctx.fillStyle = COLORS[index % COLORS.length];
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
      ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 4;
      ctx.stroke();

      const labelAngle = startAngle + sliceAngle / 2;
      const labelRadius = (outerRadius + innerRadius) / 2;
      const labelX = centerX + labelRadius * Math.cos(labelAngle);
      const labelY = centerY + labelRadius * Math.sin(labelAngle);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${item.value}%`, labelX, labelY);

      currentAngle = endAngle;
    });

    // Legend
    let legendY = 200;
    data.forEach((item: any, index: number) => {
      ctx.fillStyle = COLORS[index % COLORS.length];
      ctx.fillRect(850, legendY, 30, 30);
      ctx.fillStyle = '#2C3E50';
      ctx.font = '18px Arial';
      ctx.textAlign = 'left';
      const label = item.label.length > 30 ? item.label.substring(0, 27) + '...' : item.label;
      ctx.fillText(label, 890, legendY + 22);
      ctx.fillStyle = COLORS[index % COLORS.length];
      ctx.font = 'bold 18px Arial';
      ctx.fillText(`${item.value}%`, 890, legendY + 45);
      legendY += 70;
    });
  }

  if (type === 'area') {
    const chartArea = { x: 100, y: 150, width: 1000, height: 480 };
    const maxValue = Math.max(...data.values);
    const pointSpacing = chartArea.width / (data.labels.length - 1);

    // Grid
    ctx.strokeStyle = '#E8E8E8';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = chartArea.y + (chartArea.height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(chartArea.x, y);
      ctx.lineTo(chartArea.x + chartArea.width, y);
      ctx.stroke();
    }

    // Area
    const gradient = ctx.createLinearGradient(0, chartArea.y, 0, chartArea.y + chartArea.height);
    gradient.addColorStop(0, COLORS[0] + '80');
    gradient.addColorStop(1, COLORS[0] + '20');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(chartArea.x, chartArea.y + chartArea.height);
    data.values.forEach((value: number, index: number) => {
      const x = chartArea.x + index * pointSpacing;
      const y = chartArea.y + chartArea.height - (value / maxValue) * chartArea.height;
      if (index === 0) ctx.lineTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(chartArea.x + chartArea.width, chartArea.y + chartArea.height);
    ctx.closePath();
    ctx.fill();

    // Line
    ctx.strokeStyle = COLORS[0];
    ctx.lineWidth = 5;
    ctx.beginPath();
    data.values.forEach((value: number, index: number) => {
      const x = chartArea.x + index * pointSpacing;
      const y = chartArea.y + chartArea.height - (value / maxValue) * chartArea.height;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Points
    data.values.forEach((value: number, index: number) => {
      const x = chartArea.x + index * pointSpacing;
      const y = chartArea.y + chartArea.height - (value / maxValue) * chartArea.height;
      ctx.fillStyle = COLORS[0];
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // X-axis labels
    data.labels.forEach((label: string, index: number) => {
      const x = chartArea.x + index * pointSpacing;
      ctx.fillStyle = '#666666';
      ctx.font = '18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, chartArea.y + chartArea.height + 35);
    });
  }

  return canvas.toDataURL('image/png', 1.0);
}

// Create Phase Timeline Chart (multi-line area chart)
async function createPhaseTimelineChart(
  timelineData: any[],
  title: string
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 700;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Title
  ctx.fillStyle = '#2C3E50';
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(title, canvas.width / 2, 50);

  const chartArea = { x: 100, y: 120, width: 1000, height: 520 };
  const maxValue = 100;
  const pointSpacing = chartArea.width / (timelineData.length - 1);

  // Grid
  ctx.strokeStyle = '#E8E8E8';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = chartArea.y + (chartArea.height / 5) * i;
    ctx.beginPath();
    ctx.moveTo(chartArea.x, y);
    ctx.lineTo(chartArea.x + chartArea.width, y);
    ctx.stroke();
  }

  const phases = ['surveys', 'foundations', 'cabinet', 'cable', 'controlRoom', 'ppic3'];
  
  // Draw lines for each phase
  phases.forEach((phase, phaseIndex) => {
    const color = PHASE_COLORS[phase] || COLORS[phaseIndex % COLORS.length];
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    timelineData.forEach((point: any, index: number) => {
      const value = point[phase] || 0;
      const x = chartArea.x + index * pointSpacing;
      const y = chartArea.y + chartArea.height - (value / maxValue) * chartArea.height;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // Draw points
    timelineData.forEach((point: any, index: number) => {
      const value = point[phase] || 0;
      const x = chartArea.x + index * pointSpacing;
      const y = chartArea.y + chartArea.height - (value / maxValue) * chartArea.height;
      
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  // X-axis labels
  timelineData.forEach((point: any, index: number) => {
    const x = chartArea.x + index * pointSpacing;
    ctx.fillStyle = '#666666';
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(point.month, x, chartArea.y + chartArea.height + 35);
  });

  // Legend
  let legendY = chartArea.y + 20;
  phases.forEach((phase, index) => {
    const color = PHASE_COLORS[phase] || COLORS[index % COLORS.length];
    const phaseName = phase.charAt(0).toUpperCase() + phase.slice(1).replace(/([A-Z])/g, ' $1');
    
    ctx.fillStyle = color;
    ctx.fillRect(850, legendY, 20, 20);
    ctx.fillStyle = '#2C3E50';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(phaseName, 880, legendY + 15);
    legendY += 30;
  });

  return canvas.toDataURL('image/png', 1.0);
}

// Create Planned vs Actual Chart
async function createPlannedVsActualChart(
  timelineData: any[],
  phaseName: string,
  color: string,
  title: string
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 700;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Title
  ctx.fillStyle = '#2C3E50';
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(title, canvas.width / 2, 50);

  const chartArea = { x: 100, y: 120, width: 1000, height: 520 };
  const maxValue = 100;
  const pointSpacing = chartArea.width / (timelineData.length - 1);

  // Grid
  ctx.strokeStyle = '#E8E8E8';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = chartArea.y + (chartArea.height / 5) * i;
    ctx.beginPath();
    ctx.moveTo(chartArea.x, y);
    ctx.lineTo(chartArea.x + chartArea.width, y);
    ctx.stroke();
  }

  // Draw planned line (dashed)
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 5]);
  ctx.beginPath();
  timelineData.forEach((point: any, index: number) => {
    const value = point.planned || 0;
    const x = chartArea.x + index * pointSpacing;
    const y = chartArea.y + chartArea.height - (value / maxValue) * chartArea.height;
    
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  // Draw actual line (solid)
  ctx.setLineDash([]);
  ctx.beginPath();
  timelineData.forEach((point: any, index: number) => {
    const value = point.actual || 0;
    const x = chartArea.x + index * pointSpacing;
    const y = chartArea.y + chartArea.height - (value / maxValue) * chartArea.height;
    
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  // Draw points
  timelineData.forEach((point: any, index: number) => {
    const x = chartArea.x + index * pointSpacing;
    
    // Planned point
    const plannedY = chartArea.y + chartArea.height - ((point.planned || 0) / maxValue) * chartArea.height;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, plannedY, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Actual point
    const actualY = chartArea.y + chartArea.height - ((point.actual || 0) / maxValue) * chartArea.height;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, actualY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x, actualY, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  // X-axis labels
  timelineData.forEach((point: any, index: number) => {
    const x = chartArea.x + index * pointSpacing;
    ctx.fillStyle = '#666666';
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(point.month, x, chartArea.y + chartArea.height + 35);
  });

  // Legend
  ctx.fillStyle = color;
  ctx.setLineDash([10, 5]);
  ctx.beginPath();
  ctx.moveTo(850, 200);
  ctx.lineTo(900, 200);
  ctx.stroke();
  ctx.fillStyle = '#2C3E50';
  ctx.font = '16px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('Planned', 910, 205);

  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(850, 230);
  ctx.lineTo(900, 230);
  ctx.stroke();
  ctx.fillText('Actual', 910, 235);

  return canvas.toDataURL('image/png', 1.0);
}

// Create KPI Cards with proper icons
async function createKPICards(data: ExportData): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 500;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#2C3E50';
  ctx.font = 'bold 42px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Milestone Progress', canvas.width / 2, 50);

  const cardWidth = 240;
  const cardHeight = 380;
  const spacing = 20;
  const totalWidth = (data.installationPhases.length * cardWidth) + ((data.installationPhases.length - 1) * spacing);
  const startX = (canvas.width - totalWidth) / 2;
  const startY = 100;

  data.installationPhases.forEach((phase, index) => {
    const x = startX + index * (cardWidth + spacing);
    const y = startY;
    const iconPath = ICON_PATHS[phase.key] || ICON_PATHS.surveys;

    // Card shadow
    ctx.fillStyle = '#E0E0E0';
    ctx.fillRect(x + 4, y + 4, cardWidth, cardHeight);

    // Card background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, cardWidth, cardHeight);
    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, cardWidth, cardHeight);

    // Colored top border
    ctx.fillStyle = COLORS[index % COLORS.length];
    ctx.fillRect(x, y, cardWidth, 6);

    // Icon background
    ctx.fillStyle = COLORS[index % COLORS.length] + '20';
    ctx.fillRect(x + 15, y + 20, 50, 50);
    ctx.strokeStyle = COLORS[index % COLORS.length];
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 15, y + 20, 50, 50);

    // Draw icon (simplified SVG path rendering)
    ctx.strokeStyle = COLORS[index % COLORS.length];
    ctx.fillStyle = COLORS[index % COLORS.length];
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Draw icon based on phase key
    const iconX = x + 40;
    const iconY = y + 45;
    const iconSize = 30;
    
    if (phase.key === 'surveys') {
      // Clipboard check icon
      ctx.strokeRect(iconX - 12, iconY - 12, 24, 30);
      ctx.beginPath();
      ctx.moveTo(iconX - 8, iconY - 8);
      ctx.lineTo(iconX - 8, iconY - 20);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(iconX - 4, iconY + 4);
      ctx.lineTo(iconX + 4, iconY + 8);
      ctx.lineTo(iconX + 12, iconY - 4);
      ctx.stroke();
    } else if (phase.key === 'foundations') {
      // Building icon
      ctx.fillRect(iconX - 15, iconY - 10, 30, 30);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(iconX - 10, iconY - 5, 8, 8);
      ctx.fillRect(iconX + 2, iconY - 5, 8, 8);
      ctx.fillRect(iconX - 10, iconY + 5, 8, 8);
      ctx.fillRect(iconX + 2, iconY + 5, 8, 8);
      ctx.fillStyle = COLORS[index % COLORS.length];
    } else if (phase.key === 'cabinet') {
      // Camera icon
      ctx.beginPath();
      ctx.arc(iconX, iconY, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillRect(iconX - 8, iconY - 15, 16, 10);
    } else if (phase.key === 'cable') {
      // Lightning icon
      ctx.beginPath();
      ctx.moveTo(iconX - 8, iconY - 15);
      ctx.lineTo(iconX + 2, iconY);
      ctx.lineTo(iconX - 4, iconY);
      ctx.lineTo(iconX + 8, iconY + 15);
      ctx.lineTo(iconX - 2, iconY);
      ctx.lineTo(iconX + 4, iconY);
      ctx.closePath();
      ctx.fill();
    } else if (phase.key === 'controlRoom') {
      // Home icon
      ctx.beginPath();
      ctx.moveTo(iconX, iconY - 15);
      ctx.lineTo(iconX - 12, iconY - 5);
      ctx.lineTo(iconX - 12, iconY + 10);
      ctx.lineTo(iconX + 12, iconY + 10);
      ctx.lineTo(iconX + 12, iconY - 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(iconX - 6, iconY, 12, 10);
      ctx.fillStyle = COLORS[index % COLORS.length];
    } else if (phase.key === 'ppic3') {
      // Radio/Wifi icon
      ctx.beginPath();
      ctx.arc(iconX, iconY, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(iconX, iconY, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(iconX, iconY, 16, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Percentage
    ctx.fillStyle = COLORS[index % COLORS.length];
    ctx.font = 'bold 56px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${phase.percentage}%`, x + cardWidth / 2, y + 180);

    // Title
    ctx.fillStyle = '#2C3E50';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    const words = phase.title.toUpperCase().split(' ');
    words.forEach((word, wordIdx) => {
      ctx.fillText(word, x + cardWidth / 2, y + 220 + wordIdx * 18);
    });

    // Status
    const status = phase.percentage === 100 ? 'Completed' : 
                   phase.percentage >= 80 ? 'Near Complete' : 
                   phase.percentage >= 50 ? 'In Progress' : 'Started';
    ctx.fillStyle = '#666666';
    ctx.font = '14px Arial';
    ctx.fillText(status, x + cardWidth / 2, y + 310);

    // Progress bar
    const barWidth = cardWidth - 60;
    const barHeight = 12;
    const barX = x + 30;
    const barY = y + 340;

    ctx.fillStyle = '#E0E0E0';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const progressWidth = (phase.percentage / 100) * barWidth;
    const gradient = ctx.createLinearGradient(barX, barY, barX + progressWidth, barY);
    gradient.addColorStop(0, COLORS[index % COLORS.length]);
    gradient.addColorStop(1, COLORS[index % COLORS.length] + 'CC');
    ctx.fillStyle = gradient;
    ctx.fillRect(barX, barY, progressWidth, barHeight);
  });

  return canvas.toDataURL('image/png', 1.0);
}

// Create PPTX file structure
export async function exportDashboardToPPTX(data: ExportData) {
  try {
    const zip = new JSZip();

    // Generate all chart images
    console.log('Generating KPI Cards...');
    const kpiCardsImage = await createKPICards(data);
    
    console.log('Generating Phase Breakdown Chart...');
    const barChartData = data.installationPhases.map(phase => ({
      label: phase.title,
      value: phase.percentage
    }));
    const barChartImage = await createChartImage('bar', barChartData, 'Phase Breakdown - Installation Progress by Phase');
    
    console.log('Generating Phase Distribution Chart...');
    const pieChartData = data.installationPhases.map(phase => ({
      label: phase.title,
      value: phase.percentage
    }));
    const pieChartImage = await createChartImage('pie', pieChartData, 'Phase Distribution Analysis');

    // Generate Trend Chart (overall progress)
    let areaChartImage: string | null = null;
    if (data.cityData.timeline && data.cityData.timeline.length > 0) {
      console.log('Generating Trend Chart...');
      const timelineData = {
        labels: data.cityData.timeline.map((t: any) => t.month),
        values: data.cityData.timeline.map((t: any) => t.overall)
      };
      areaChartImage = await createChartImage('area', timelineData, 'Monthly Progress Timeline');
    }

    // Generate Phase Timeline Chart (all phases over time)
    let phaseTimelineImage: string | null = null;
    if (data.cityData.timeline && data.cityData.timeline.length > 0) {
      console.log('Generating Phase Timeline Chart...');
      phaseTimelineImage = await createPhaseTimelineChart(
        data.cityData.timeline,
        'Phase Evolution Timeline - All Milestones Over Time'
      );
    }

    // Generate Planned vs Actual charts for each phase
    const plannedVsActualImages: Array<{ phaseKey: string; phaseName: string; image: string; color: string }> = [];
    const phaseColorMap: Record<string, string> = {
      surveys: PHASE_COLORS.surveys,
      foundations: PHASE_COLORS.foundations,
      cabinet: PHASE_COLORS.cabinet,
      cable: PHASE_COLORS.cable,
      controlRoom: PHASE_COLORS.controlRoom,
      ppic3: PHASE_COLORS.ppic3,
    };

    for (const phase of data.installationPhases) {
      // Check if we have detailed progress data with timeline
      const phaseData = (data.cityData as any)[phase.key];
      if (phaseData && typeof phaseData === 'object' && phaseData.timeline && phaseData.timeline.length > 0) {
        console.log(`Generating Planned vs Actual Chart for ${phase.title}...`);
        const chartImage = await createPlannedVsActualChart(
          phaseData.timeline,
          phase.title,
          phaseColorMap[phase.key] || COLORS[0],
          `Planned vs Actual Progress - ${phase.title}`
        );
        plannedVsActualImages.push({
          phaseKey: phase.key,
          phaseName: phase.title,
          image: chartImage,
          color: phaseColorMap[phase.key] || COLORS[0],
        });
      }
    }

    // Convert images to base64
    const kpiBase64 = dataURLToBase64(kpiCardsImage);
    const barBase64 = dataURLToBase64(barChartImage);
    const pieBase64 = dataURLToBase64(pieChartImage);
    const areaBase64 = areaChartImage ? dataURLToBase64(areaChartImage) : null;
    const phaseTimelineBase64 = phaseTimelineImage ? dataURLToBase64(phaseTimelineImage) : null;
    const plannedVsActualBase64s = plannedVsActualImages.map(item => ({
      ...item,
      base64: dataURLToBase64(item.image),
    }));

    // Calculate total slides: title (1) + KPI (1) + bar (1) + pie (1) + trend (1 if exists) + phase timeline (1 if exists) + planned vs actual (N) + insights (1)
    let slideCount = 4; // title + KPI + bar + pie
    if (areaBase64) slideCount++;
    if (phaseTimelineBase64) slideCount++;
    slideCount += plannedVsActualBase64s.length;
    slideCount += 1; // insights slide
    
    const totalSlides = slideCount;
    const slideNumbers = Array.from({ length: totalSlides }, (_, i) => i + 1);
    
    // Create PPTX structure
    // Image mapping: image1=KPI, image2=Bar, image3=Pie, image4=Trend, image5=PhaseTimeline, image6+=PlannedVsActual
    let imageIndex = 1;
    const imageMap: Record<number, string> = {
      [imageIndex++]: 'image1.png', // KPI Cards
      [imageIndex++]: 'image2.png', // Bar Chart
      [imageIndex++]: 'image3.png', // Pie Chart
    };
    if (areaBase64) imageMap[imageIndex++] = `image${imageIndex}.png`; // Trend Chart
    if (phaseTimelineBase64) imageMap[imageIndex++] = `image${imageIndex}.png`; // Phase Timeline
    plannedVsActualBase64s.forEach(() => {
      imageMap[imageIndex++] = `image${imageIndex}.png`;
    });

    const imageOverrides = Object.values(imageMap).map(img => 
      `<Override PartName="/ppt/media/${img}" ContentType="image/png"/>`
    ).join('\n');

    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
${slideNumbers.map(num => `<Override PartName="/ppt/slides/slide${num}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('\n')}
${imageOverrides}
</Types>`;
    zip.file('[Content_Types].xml', contentTypesXml);

    // Create _rels folder
    const relsFolder = zip.folder('_rels');
    relsFolder?.file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`);

    // Create ppt folder structure
    const pptFolder = zip.folder('ppt');
    const slidesFolder = pptFolder?.folder('slides');
    const mediaFolder = pptFolder?.folder('media');
    const pptRelsFolder = pptFolder?.folder('_rels');
    const slidesRelsFolder = slidesFolder?.folder('_rels');

    // Add images to media folder - ensure base64 strings are valid
    let currentImageIndex = 1;
    
    // Validate and add KPI cards image
    if (!kpiBase64 || kpiBase64.length < 100) {
      throw new Error('Failed to generate KPI cards image');
    }
    mediaFolder?.file(`image${currentImageIndex++}.png`, kpiBase64, { base64: true });
    
    // Validate and add bar chart image
    if (!barBase64 || barBase64.length < 100) {
      throw new Error('Failed to generate bar chart image');
    }
    mediaFolder?.file(`image${currentImageIndex++}.png`, barBase64, { base64: true });
    
    // Validate and add pie chart image
    if (!pieBase64 || pieBase64.length < 100) {
      throw new Error('Failed to generate pie chart image');
    }
    mediaFolder?.file(`image${currentImageIndex++}.png`, pieBase64, { base64: true });
    
    // Add trend chart if available
    if (areaBase64) {
      if (areaBase64.length < 100) {
        console.warn('Trend chart image seems invalid, skipping');
      } else {
        mediaFolder?.file(`image${currentImageIndex++}.png`, areaBase64, { base64: true });
      }
    }
    
    // Add phase timeline chart if available
    if (phaseTimelineBase64) {
      if (phaseTimelineBase64.length < 100) {
        console.warn('Phase timeline chart image seems invalid, skipping');
      } else {
        mediaFolder?.file(`image${currentImageIndex++}.png`, phaseTimelineBase64, { base64: true });
      }
    }
    
    // Add planned vs actual charts
    plannedVsActualBase64s.forEach(item => {
      if (item.base64 && item.base64.length >= 100) {
        mediaFolder?.file(`image${currentImageIndex++}.png`, item.base64, { base64: true });
      } else {
        console.warn(`Planned vs Actual chart for ${item.phaseName} seems invalid, skipping`);
      }
    });

    // Create slide XMLs with embedded images - Professional layout for government presentation
    const createSlideXML = (slideNum: number, title: string, imageFileName: string, imageWidth: number = 9144000, imageHeight: number = 5143500) => {
      // Professional slide dimensions (16:9)
      const slideWidth = 9144000;  // 10 inches in EMU
      const slideHeight = 6858000;  // 7.5 inches in EMU
      
      // Title positioning - top center with proper margins (ensuring it fits)
      const titleX = 914400;        // 1 inch margin from left
      const titleY = 342900;        // 0.5 inch from top (reduced from 457200)
      const titleWidth = 7315200;   // 8 inches wide
      const titleHeight = 800000;   // Reduced height to ensure it fits (was 914400)
      
      // Chart positioning - centered below title with proper spacing
      const chartMarginSide = 457200;  // Side margins (0.5 inch each side)
      const chartY = titleY + titleHeight + 342900; // Title height + spacing (reduced spacing)
      const chartWidth = slideWidth - (chartMarginSide * 2);
      const chartHeight = slideHeight - chartY - 457200; // Leave bottom margin
      
      // Calculate actual chart dimensions maintaining aspect ratio
      const aspectRatio = imageWidth / imageHeight;
      let finalChartWidth = chartWidth;
      let finalChartHeight = chartWidth / aspectRatio;
      
      // If chart is too tall, scale down
      if (finalChartHeight > chartHeight) {
        finalChartHeight = chartHeight;
        finalChartWidth = chartHeight * aspectRatio;
      }
      
      // Center the chart horizontally
      const finalChartX = (slideWidth - finalChartWidth) / 2;
      
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${slideWidth}" cy="${slideHeight}"/><a:chOff x="0" y="0"/><a:chExt cx="${slideWidth}" cy="${slideHeight}"/></a:xfrm></p:grpSpPr>
      
      <!-- Professional Title Box - Enhanced with Underline Accent -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1" noMove="1" noResize="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="${titleX}" y="${titleY}"/>
            <a:ext cx="${titleWidth}" cy="${titleHeight}"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr anchor="ctr" wrap="square" rtlCol="0" vertOverflow="clip" horzOverflow="clip" vert="horz" numCol="1" spcCol="0" insetL="91440" insetR="91440" insetT="45720" insetB="45720">
            <a:spAutoFit/>
          </a:bodyPr>
          <a:lstStyle/>
          <a:p>
            <a:pPr algn="ctr" marL="0" marR="0" indent="0"/>
            <a:r>
              <a:rPr lang="en-US" sz="4800" b="1" baseline="0" kern="800">
                <a:solidFill><a:srgbClr val="1F2937"/></a:solidFill>
                <a:effectLst>
                  <a:outerShdw blurRad="25400" dist="25400" dir="2700000" algn="ctr">
                    <a:srgbClr val="000000"><a:alpha val="30000"/></a:srgbClr>
                  </a:outerShdw>
                </a:effectLst>
              </a:rPr>
              <a:t>${escapeXml(title.length > 55 ? title.substring(0, 52) + '...' : title)}</a:t>
            </a:r>
            <a:endParaRPr lang="en-US"/>
          </a:p>
        </p:txBody>
      </p:sp>
      
      <!-- Decorative Underline for Title - Properly positioned -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="12" name="Title Underline"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="${titleX + 1828800}" y="${titleY + titleHeight - 91440}"/>
            <a:ext cx="${Math.max(2743200, titleWidth - 3657600)}" cy="91440"/>
          </a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="3B82F6"/></a:solidFill>
          <a:ln w="0"><a:noFill/></a:ln>
        </p:spPr>
      </p:sp>
      
      <!-- Chart Image - Centered and Properly Sized -->
      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="3" name="Chart Image" descr="Data Visualization"/>
          <p:cNvPicPr>
            <a:picLocks noChangeAspect="1" noRot="1" noChangeArrowheads="1" noMove="0" noResize="0"/>
          </p:cNvPicPr>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="rId2">
            <a:extLst>
              <a:ext uri="{28A0092B-C50C-407E-A947-70E740481C1C}">
                <a14:useLocalDpi xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" val="0"/>
              </a:ext>
            </a:extLst>
          </a:blip>
          <a:stretch><a:fillRect/></a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm>
            <a:off x="${Math.round(finalChartX)}" y="${Math.round(chartY)}"/>
            <a:ext cx="${Math.round(finalChartWidth)}" cy="${Math.round(finalChartHeight)}"/>
          </a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:noFill/>
          <a:ln w="0"><a:noFill/></a:ln>
        </p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
    };

    // Helper to escape XML special characters
    function escapeXml(unsafe: string): string {
      return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '&': return '&amp;';
          case '\'': return '&apos;';
          case '"': return '&quot;';
          default: return c;
        }
      });
    }

    // Professional Title Slide - Premium Government Presentation Quality
    const overallProgress = data.cityData.overall;
    const progressColor = overallProgress >= 80 ? '10B981' : overallProgress >= 60 ? 'F59E0B' : 'EF4444';
    const progressLabel = overallProgress >= 80 ? 'Excellent' : overallProgress >= 60 ? 'Good' : 'Needs Attention';
    
    slidesFolder?.file('slide1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9144000" cy="6858000"/></a:xfrm></p:grpSpPr>
      
      <!-- Decorative Top Border -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="10" name="Top Border"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="0" y="0"/><a:ext cx="9144000" cy="228600"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="1E3A8A"/></a:solidFill>
          <a:ln w="0"><a:noFill/></a:ln>
        </p:spPr>
      </p:sp>
      
      <!-- Main Title - Premium Styling -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Main Title"/><p:cNvSpPr/><p:nvPr><p:ph type="ctrTitle"/></p:nvPr></p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="1143000" y="2286000"/>
            <a:ext cx="6858000" cy="800000"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr anchor="ctr" wrap="square" rtlCol="0" vertOverflow="clip" horzOverflow="clip" vert="horz" numCol="1" spcCol="0" insetL="91440" insetR="91440" insetT="45720" insetB="45720">
            <a:spAutoFit/>
          </a:bodyPr>
          <a:lstStyle/>
          <a:p>
            <a:pPr algn="ctr" defTabSz="914400"/>
            <a:r>
              <a:rPr lang="en-US" sz="7200" b="1" baseline="0" kern="800">
                <a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>
                <a:effectLst>
                  <a:outerShdw blurRad="38100" dist="38100" dir="2700000" algn="ctr" rotWithShape="0">
                    <a:srgbClr val="000000"><a:alpha val="45000"/></a:srgbClr>
                  </a:outerShdw>
                </a:effectLst>
              </a:rPr>
              <a:t>${escapeXml(data.cityName.length > 35 ? data.cityName.substring(0, 32) + '...' : data.cityName)}</a:t>
            </a:r>
            <a:endParaRPr lang="en-US"/>
          </a:p>
        </p:txBody>
      </p:sp>
      
      <!-- Subtitle - Properly Positioned -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Subtitle"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="2286000" y="3429000"/>
            <a:ext cx="4572000" cy="457200"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr anchor="ctr" wrap="square" rtlCol="0" vertOverflow="clip" horzOverflow="clip" vert="horz" numCol="1" spcCol="0" insetL="91440" insetR="91440" insetT="45720" insetB="45720">
            <a:spAutoFit/>
          </a:bodyPr>
          <a:lstStyle/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="en-US" sz="3000" baseline="0">
                <a:solidFill><a:srgbClr val="E0E7FF"/></a:solidFill>
              </a:rPr>
              <a:t>Camera Installation Progress Dashboard</a:t>
            </a:r>
            <a:endParaRPr lang="en-US"/>
          </a:p>
        </p:txBody>
      </p:sp>
      
      <!-- Large Progress Percentage Display -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="4" name="Progress Percentage"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="3200400" y="4114800"/>
            <a:ext cx="2743200" cy="1371600"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr anchor="ctr" wrap="square" rtlCol="0" vertOverflow="clip" horzOverflow="clip" vert="horz" numCol="1" spcCol="0" insetL="91440" insetR="91440" insetT="45720" insetB="45720">
            <a:spAutoFit/>
          </a:bodyPr>
          <a:lstStyle/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="en-US" sz="10000" b="1" baseline="0">
                <a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>
                <a:effectLst>
                  <a:outerShdw blurRad="50800" dist="50800" dir="2700000" algn="ctr">
                    <a:srgbClr val="000000"><a:alpha val="55000"/></a:srgbClr>
                  </a:outerShdw>
                </a:effectLst>
              </a:rPr>
              <a:t>${overallProgress}%</a:t>
            </a:r>
            <a:endParaRPr lang="en-US"/>
          </a:p>
        </p:txBody>
      </p:sp>
      
      <!-- Progress Label Badge -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="5" name="Progress Label"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="3429000" y="5715000"/>
            <a:ext cx="2286000" cy="571500"/>
          </a:xfrm>
          <a:prstGeom prst="roundRect">
            <a:avLst>
              <a:gd name="adj" fmla="val 10000"/>
            </a:avLst>
          </a:prstGeom>
          <a:solidFill><a:srgbClr val="${progressColor}"/></a:solidFill>
          <a:ln w="38100">
            <a:solidFill><a:srgbClr val="1F2937"/></a:solidFill>
          </a:ln>
          <a:effectLst>
            <a:outerShdw blurRad="25400" dist="25400" dir="2700000" algn="ctr">
              <a:srgbClr val="000000"><a:alpha val="35000"/></a:srgbClr>
            </a:outerShdw>
          </a:effectLst>
        </p:spPr>
        <p:txBody>
          <a:bodyPr anchor="ctr" wrap="square" rtlCol="0" vertOverflow="clip" horzOverflow="clip" vert="horz" numCol="1" spcCol="0" insetL="91440" insetR="91440" insetT="45720" insetB="45720">
            <a:spAutoFit/>
          </a:bodyPr>
          <a:lstStyle/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="en-US" sz="3000" b="1" baseline="0">
                <a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>
              </a:rPr>
              <a:t>${progressLabel}</a:t>
            </a:r>
            <a:endParaRPr lang="en-US"/>
          </a:p>
        </p:txBody>
      </p:sp>
      
      <!-- Authority Name - Bottom Footer Style -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="6" name="Authority"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="2743200" y="6400800"/>
            <a:ext cx="3657600" cy="342900"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr anchor="ctr" wrap="square" rtlCol="0" vertOverflow="clip" horzOverflow="clip" vert="horz" numCol="1" spcCol="0" insetL="91440" insetR="91440" insetT="45720" insetB="45720">
            <a:spAutoFit/>
          </a:bodyPr>
          <a:lstStyle/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="en-US" sz="2600" baseline="0">
                <a:solidFill><a:srgbClr val="C7D2FE"/></a:solidFill>
              </a:rPr>
              <a:t>Punjab Safe City Authority</a:t>
            </a:r>
            <a:endParaRPr lang="en-US"/>
          </a:p>
        </p:txBody>
      </p:sp>
      
      <!-- Decorative Bottom Accent -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="11" name="Bottom Accent"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="0" y="6629400"/><a:ext cx="9144000" cy="228600"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="1E3A8A"/></a:solidFill>
          <a:ln w="0"><a:noFill/></a:ln>
        </p:spPr>
      </p:sp>
    </p:spTree>
    
    <!-- Premium Gradient Background -->
    <p:bg>
      <p:bgPr>
        <a:gradFill>
          <a:gsLst>
            <a:gs pos="0">
              <a:srgbClr val="1E3A8A">
                <a:alpha val="100000"/>
              </a:srgbClr>
            </a:gs>
            <a:gs pos="50000">
              <a:srgbClr val="2563EB">
                <a:alpha val="100000"/>
              </a:srgbClr>
            </a:gs>
            <a:gs pos="100000">
              <a:srgbClr val="3B82F6">
                <a:alpha val="100000"/>
              </a:srgbClr>
            </a:gs>
          </a:gsLst>
          <a:lin ang="5400000" scaled="0"/>
        </a:gradFill>
      </p:bgPr>
    </p:bg>
  </p:cSld>
</p:sld>`);

    // Create slides in order with proper image file mapping
    // Reset image index to match the order we added images to media folder
    let currentSlideNum = 2;
    let slideImageIndex = 1; // Renamed to avoid conflict with currentImageIndex above
    const slideImageMap: Record<number, string> = {}; // Maps slide number to image filename

    // Slide 2: KPI Cards (wider image - adjust for better fit)
    const kpiImageFile = `image${slideImageIndex}.png`;
    slideImageMap[currentSlideNum] = kpiImageFile;
    // KPI cards are wider, so adjust dimensions for better presentation
    slidesFolder?.file(`slide${currentSlideNum}.xml`, createSlideXML(currentSlideNum, 'Milestone Progress', kpiImageFile, 1600, 500));
    currentSlideNum++;
    slideImageIndex++;
    
    // Slide 3: Bar Chart
    const barImageFile = `image${slideImageIndex}.png`;
    slideImageMap[currentSlideNum] = barImageFile;
    slidesFolder?.file(`slide${currentSlideNum}.xml`, createSlideXML(currentSlideNum, 'Phase Breakdown Analysis', barImageFile, 1200, 700));
    currentSlideNum++;
    slideImageIndex++;
    
    // Slide 4: Pie Chart
    const pieImageFile = `image${slideImageIndex}.png`;
    slideImageMap[currentSlideNum] = pieImageFile;
    slidesFolder?.file(`slide${currentSlideNum}.xml`, createSlideXML(currentSlideNum, 'Phase Distribution Analysis', pieImageFile, 1200, 700));
    currentSlideNum++;
    slideImageIndex++;

    // Slide 5: Trend Chart (if available)
    if (areaBase64) {
      const trendImageFile = `image${slideImageIndex}.png`;
      slideImageMap[currentSlideNum] = trendImageFile;
      slidesFolder?.file(`slide${currentSlideNum}.xml`, createSlideXML(currentSlideNum, 'Monthly Progress Timeline', trendImageFile, 1200, 700));
      currentSlideNum++;
      slideImageIndex++;
    }

    // Slide 6: Phase Timeline Chart (if available)
    if (phaseTimelineBase64) {
      const phaseTimelineImageFile = `image${slideImageIndex}.png`;
      slideImageMap[currentSlideNum] = phaseTimelineImageFile;
      slidesFolder?.file(`slide${currentSlideNum}.xml`, createSlideXML(currentSlideNum, 'Phase Evolution Timeline', phaseTimelineImageFile, 1200, 700));
      currentSlideNum++;
      slideImageIndex++;
    }

    // Slides 7+: Planned vs Actual charts
    plannedVsActualBase64s.forEach(item => {
      const pvaImageFile = `image${slideImageIndex}.png`;
      slideImageMap[currentSlideNum] = pvaImageFile;
      slidesFolder?.file(`slide${currentSlideNum}.xml`, createSlideXML(currentSlideNum, `Planned vs Actual - ${item.phaseName}`, pvaImageFile, 1200, 700));
      currentSlideNum++;
      slideImageIndex++;
    });

    // Professional Insights slide (always the last slide)
    const insightsSlideNum = currentSlideNum;
    const insights = generateInsights(data);
    
    // Calculate better spacing for insights
    const titleY = 457200;
    const titleHeight = 914400;
    const startY = titleY + titleHeight + 457200;
    const itemHeight = 685800; // Better spacing between items
    const maxItems = Math.min(insights.length, 6); // Limit to 6 items for better readability
    
    slidesFolder?.file(`slide${insightsSlideNum}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9144000" cy="6858000"/></a:xfrm></p:grpSpPr>
      
      <!-- Professional Title -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="914400" y="${titleY}"/>
            <a:ext cx="7315200" cy="${titleHeight}"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr anchor="ctr" wrap="square">
            <a:spAutoFit/>
          </a:bodyPr>
          <a:lstStyle/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="en-US" sz="5000" b="1" baseline="0">
                <a:solidFill><a:srgbClr val="1F2937"/></a:solidFill>
                <a:effectLst>
                  <a:outerShdw blurRad="38100" dist="38100" dir="2700000" algn="ctr">
                    <a:srgbClr val="000000"><a:alpha val="30000"/></a:srgbClr>
                  </a:outerShdw>
                </a:effectLst>
              </a:rPr>
              <a:t>Key Insights &amp; Recommendations</a:t>
            </a:r>
            <a:endParaRPr lang="en-US"/>
          </a:p>
        </p:txBody>
      </p:sp>
      
      <!-- Professional Bullet Points with Better Styling -->
      ${insights.slice(0, maxItems).map((insight, idx) => `
      <p:sp>
        <p:nvSpPr><p:cNvPr id="${idx + 3}" name="Insight ${idx + 1}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="1371600" y="${startY + idx * itemHeight}"/>
            <a:ext cx="6400800" cy="571500"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr wrap="square" lIns="914400" rIns="914400" tIns="45720" bIns="45720">
            <a:spAutoFit/>
          </a:bodyPr>
          <a:lstStyle>
            <a:lvl1pPr algn="l" marL="457200" indent="-457200">
              <a:buFont typeface="Calibri" panose="020F0502020204030204" pitchFamily="34" charset="0"/>
              <a:buChar char="•"/>
              <a:defRPr sz="2800" baseline="0">
                <a:solidFill><a:srgbClr val="374151"/></a:solidFill>
              </a:defRPr>
            </a:lvl1pPr>
          </a:lstStyle>
          <a:p>
            <a:pPr algn="l" marL="0" indent="-457200">
              <a:buFont typeface="Calibri" panose="020F0502020204030204" pitchFamily="34" charset="0"/>
              <a:buChar char="•"/>
            </a:pPr>
            <a:r>
              <a:rPr lang="en-US" sz="2800" baseline="0">
                <a:solidFill><a:srgbClr val="374151"/></a:solidFill>
              </a:rPr>
              <a:t>${escapeXml(insight)}</a:t>
            </a:r>
            <a:endParaRPr lang="en-US"/>
          </a:p>
        </p:txBody>
      </p:sp>
      `).join('')}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`);

    // Create slide relationships - properly map images to slides
    for (let i = 1; i <= totalSlides; i++) {
      const slideRels: string[] = [
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>`
      ];
      
      // Add image relationships for chart slides (skip title slide 1 and insights slide)
      if (i > 1 && i < insightsSlideNum && slideImageMap[i]) {
        const imageFile = slideImageMap[i];
        slideRels.push(`<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${imageFile}"/>`);
      }
      
      slideRels.push('</Relationships>');
      slidesRelsFolder?.file(`slide${i}.xml.rels`, slideRels.join('\n'));
    }

    // Create presentation.xml with correct slide references
    const slideIds = slideNumbers.map((num, idx) => `<p:sldId id="${256 + idx}" r:id="rId${num + 1}"/>`).join('\n    ');
    pptFolder?.file('presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>
    ${slideIds}
  </p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`);

    // Create presentation relationships - map each slide number to its rId
    const presentationRels = [
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`,
      ...slideNumbers.map((num, idx) => `<Relationship Id="rId${idx + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${num}.xml"/>`),
      `</Relationships>`
    ].join('\n');
    pptRelsFolder?.file('presentation.xml.rels', presentationRels);

    // Create master slide and layout
    const slideMastersFolder = pptFolder?.folder('slideMasters');
    const slideMastersRelsFolder = slideMastersFolder?.folder('_rels');
    const slideLayoutsFolder = pptFolder?.folder('slideLayouts');
    const slideLayoutsRelsFolder = slideLayoutsFolder?.folder('_rels');
    
    slideMastersFolder?.file('slideMaster1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9144000" cy="6858000"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
</p:sldMaster>`);
    
    slideMastersRelsFolder?.file('slideMaster1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`);
    
    slideLayoutsFolder?.file('slideLayout1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" showMasterSp="0">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9144000" cy="6858000"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`);
    
    slideLayoutsRelsFolder?.file('slideLayout1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>
</Relationships>`);

    // Generate and download PPTX
    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const sanitizedName = data.cityName.replace(/[^a-zA-Z0-9]/g, '_');
    link.href = url;
    link.download = `${sanitizedName}_Installation_Progress_${new Date().toISOString().split('T')[0]}.pptx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Success - dialog will be shown by the calling component
  } catch (error) {
    console.error('Error exporting presentation:', error);
    throw error; // Re-throw so calling component can handle it
  }
}

function generateInsights(data: ExportData): string[] {
  const completedPhases = data.installationPhases.filter(p => p.percentage === 100).length;
  const inProgressPhases = data.installationPhases.filter(p => p.percentage >= 50 && p.percentage < 100).length;
  const earlyPhases = data.installationPhases.filter(p => p.percentage < 50).length;

  return [
    `Overall Progress: ${data.cityData.overall}% - ${data.cityData.overall >= 80 ? 'Excellent' : data.cityData.overall >= 60 ? 'Good' : 'Needs Improvement'}`,
    `Completed Phases: ${completedPhases} out of ${data.installationPhases.length} phases fully completed`,
    `In Progress Phases: ${inProgressPhases} phases actively under implementation`,
    `Early Stage Phases: ${earlyPhases} phases requiring attention and acceleration`,
    `Highest Progress Phase: ${Math.max(...data.installationPhases.map(p => p.percentage))}% - Leading phase performance`,
    `Lowest Progress Phase: ${Math.min(...data.installationPhases.map(p => p.percentage))}% - Requires immediate focus`,
  ];
}
