import React, { useState, useEffect, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import Plotly from 'plotly.js-dist-min';
import { 
  LayoutDashboard, 
  Table as TableIcon, 
  Download, 
  Settings, 
  Cpu, 
  Upload, 
  Trash2, 
  CheckCircle2, 
  Moon, 
  Sun,
  Search,
  ChevronRight,
  ChevronLeft,
  Menu,
  X,
  BarChart3,
  AlertTriangle,
  FileText,
  MessageSquare,
  Send,
  Layers,
  TrendingUp,
  GitMerge,
  Grid3X3 as PivotIcon,
  Activity,
  Lightbulb,
  LineChart,
  Database,
  Filter,
  Settings2
} from 'lucide-react';
import { cn } from './lib/utils';
import { GoogleGenAI } from "@google/genai";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

type DataRow = Record<string, any>;

export default function App() {
  const [rawData, setRawData] = useState<DataRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  
  // Persistence: Load data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('system_raw_data');
    const savedCols = localStorage.getItem('system_columns');
    if (savedData && savedCols) {
      try {
        setRawData(JSON.parse(savedData));
        setColumns(JSON.parse(savedCols));
      } catch (e) {
        console.error("Failed to load saved data", e);
      }
    }
  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    if (rawData.length > 0) {
      localStorage.setItem('system_raw_data', JSON.stringify(rawData));
      localStorage.setItem('system_columns', JSON.stringify(columns));
    }
  }, [rawData, columns]);

  // Viz state
  const [chartType, setChartType] = useState('scatter3d');
  const [xCol, setXCol] = useState('');
  const [yCol, setYCol] = useState('');
  const [zCol, setZCol] = useState('');
  const plotRef = useRef<HTMLDivElement>(null);

  // Imputation state
  const [fillCol, setFillCol] = useState('');
  const [fillMethod, setFillMethod] = useState('mean');
  const [customVal, setCustomVal] = useState('');

  // Engineering state
  const [convertCol, setConvertCol] = useState('');
  const [convertType, setConvertType] = useState('number');
  const [newColName, setNewColName] = useState('');
  const [opCol1, setOpCol1] = useState('');
  const [opCol2, setOpCol2] = useState('');
  const [operation, setOperation] = useState('add');

  // AI Insights state
  const [insights, setInsights] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Connector state
  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [isChatting, setIsChatting] = useState(false);

  // Auto Clean state
  const [isAutoCleaning, setIsAutoCleaning] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<Record<string, string>>({});

  // Correlation state
  const [showCorrelation, setShowCorrelation] = useState(false);
  const corrRef = useRef<HTMLDivElement>(null);

  // Pivot state
  const [pivotRow, setPivotRow] = useState('');
  const [pivotCol, setPivotCol] = useState('');
  const [pivotVal, setPivotVal] = useState('');
  const [pivotAgg, setPivotAgg] = useState<'sum' | 'count' | 'avg'>('sum');

  // Merge state
  const [secondData, setSecondData] = useState<DataRow[]>([]);
  const [secondCols, setSecondCols] = useState<string[]>([]);
  const [mergeKey1, setMergeKey1] = useState('');
  const [mergeKey2, setMergeKey2] = useState('');

  // Predictive state
  const [prediction, setPrediction] = useState<string | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);

  // Monitoring state
  const [monitoringAlerts, setMonitoringAlerts] = useState<string[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  // Alerts state
  const [alerts, setAlerts] = useState<{ col: string, count: number }[]>([]);

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
      document.body.setAttribute('data-theme', savedTheme);
    }
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar';
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.body.setAttribute('data-theme', newTheme);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement> | File) => {
    const file = e instanceof File ? e : e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as DataRow[];
        const cols = results.meta.fields || [];
        setRawData(data);
        setColumns(cols);
        if (cols.length > 0) {
          setXCol(cols[0]);
          setYCol(cols[1] || cols[0]);
          setZCol(cols[2] || cols[0]);
          setFillCol(cols[0]);
        }
        setPage(1);
      },
    });
  };

  const stats = useMemo(() => {
    let nulls = 0;
    rawData.forEach(r => columns.forEach(c => {
      if (r[c] === null || r[c] === undefined || r[c] === "") nulls++;
    }));

    const uniqueRows = new Set(rawData.map(r => JSON.stringify(r)));
    const dups = rawData.length - uniqueRows.size;

    return {
      rows: rawData.length,
      cols: columns.length,
      nulls,
      dups
    };
  }, [rawData, columns]);

  const filteredData = useMemo(() => {
    return rawData.filter(row => {
      const matchesSearch = Object.values(row).some(val => 
        String(val).toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      const matchesFilters = Object.entries(filters).every(([col, val]) => {
        if (!val) return true;
        return String(row[col]) === val;
      });

      return matchesSearch && matchesFilters;
    });
  }, [rawData, searchQuery, filters]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * 15;
    return filteredData.slice(start, start + 15);
  }, [filteredData, page]);

  const totalPages = Math.ceil(filteredData.length / 15);

  const clearAllData = () => {
    setRawData([]);
    setColumns([]);
    setFilters({});
    localStorage.removeItem('system_raw_data');
    localStorage.removeItem('system_columns');
    showToast("تم مسح جميع البيانات بنجاح");
  };

  const handleFilterChange = (col: string, val: string) => {
    setFilters(prev => ({ ...prev, [col]: val }));
    setPage(1);
  };

  const getUniqueValues = (col: string) => {
    const values = Array.from(new Set(rawData.map(r => String(r[col]))))
      .filter(v => v !== 'null' && v !== 'undefined' && v !== '')
      .slice(0, 50); 
    return values;
  };

  // Plotly Effect
  useEffect(() => {
    if (!plotRef.current || rawData.length === 0) return;

    const trace: any = {
      x: rawData.map(r => r[xCol]),
      type: chartType === 'scatter3d' ? 'scatter3d' : (chartType === 'histogram' ? 'histogram' : 'scatter'),
    };

    if (chartType !== 'histogram') {
      trace.y = rawData.map(r => r[yCol]);
    }

    if (chartType === 'scatter3d') {
      trace.z = rawData.map(r => r[zCol]);
      trace.mode = 'markers';
      trace.marker = { size: 4, color: trace.z, colorscale: 'Viridis' };
    } else if (chartType === 'line') {
      trace.mode = 'lines+markers';
      trace.line = { shape: 'spline', color: '#4f46e5' };
    } else if (chartType === 'bar') {
      trace.type = 'bar';
      trace.marker = { color: '#10b981' };
    } else if (chartType === 'histogram') {
      trace.marker = { color: '#06b6d4' };
    }

    const layout = {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { 
        family: 'Cairo, sans-serif', 
        color: theme === 'dark' ? '#f1f5f9' : '#1e293b' 
      },
      margin: { t: 20, b: 40, l: 40, r: 20 },
      scene: {
        xaxis: { title: xCol },
        yaxis: { title: yCol },
        zaxis: { title: zCol }
      },
      autosize: true
    };

    Plotly.newPlot(plotRef.current, [trace], layout, { responsive: true, displaylogo: false });

    return () => {
      if (plotRef.current) Plotly.purge(plotRef.current);
    };
  }, [rawData, chartType, xCol, yCol, zCol, theme]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const cleanDups = () => {
    const unique = Array.from(new Set(rawData.map(r => JSON.stringify(r)))).map((s: string) => JSON.parse(s));
    if (unique.length === rawData.length) {
      showToast("لا توجد سجلات مكررة", 'error');
      return;
    }
    setRawData(unique);
    showToast("تمت إزالة السجلات المكررة بنجاح");
  };

  const cleanNulls = () => {
    const cleaned = rawData.filter(r => columns.every(c => r[c] !== null && r[c] !== undefined && r[c] !== ""));
    setRawData(cleaned);
    showToast("تمت إزالة السجلات التي تحتوي على قيم مفقودة");
  };

  const fillValues = () => {
    if (!fillCol) return;
    
    let val: any = customVal;
    if (fillMethod === 'mean' || fillMethod === 'median') {
      const nums = rawData.map(r => r[fillCol]).filter(v => typeof v === 'number');
      if (nums.length === 0) {
        showToast("لا يمكن تطبيق هذه العملية على بيانات غير رقمية", 'error');
        return;
      }
      if (fillMethod === 'mean') {
        val = nums.reduce((a, b) => a + b, 0) / nums.length;
      } else {
        const sorted = [...nums].sort((a, b) => a - b);
        val = sorted[Math.floor(sorted.length / 2)];
      }
    } else if (fillMethod === 'zero') {
      val = 0;
    }

    const newData = rawData.map(r => {
      if (r[fillCol] === null || r[fillCol] === undefined || r[fillCol] === "") {
        return { ...r, [fillCol]: val };
      }
      return r;
    });
    setRawData(newData);
    showToast("تمت تعبئة القيم المفقودة بنجاح");
  };

  const convertColumnType = () => {
    if (!convertCol) return;
    const newData = rawData.map(r => ({
      ...r,
      [convertCol]: convertType === 'number' ? Number(r[convertCol]) : String(r[convertCol])
    }));
    setRawData(newData);
    showToast(`تم تحويل بنية العمود ${convertCol} بنجاح`);
  };

  const createFeature = () => {
    if (!newColName || !opCol1 || !opCol2) {
      showToast("يرجى تحديد المعاملات واسم الميزة الجديدة", 'error');
      return;
    }
    const newData = rawData.map(r => {
      const v1 = Number(r[opCol1]) || 0;
      const v2 = Number(r[opCol2]) || 0;
      let res = 0;
      if (operation === 'add') res = v1 + v2;
      else if (operation === 'sub') res = v1 - v2;
      else if (operation === 'mul') res = v1 * v2;
      else if (operation === 'div') res = v2 !== 0 ? v1 / v2 : 0;
      
      return { ...r, [newColName]: res };
    });
    setRawData(newData);
    setColumns([...columns, newColName]);
    showToast(`تم اشتقاق الميزة ${newColName} بنجاح`);
  };

  const generateInsights = async () => {
    if (rawData.length === 0) return;
    setIsAnalyzing(true);
    try {
      const sample = rawData.slice(0, 20);
      const dataSummary = JSON.stringify(sample);
      
      const prompt = `أنت نظام خبير في تحليل البيانات الإحصائية. لديك العينة التالية بصيغة JSON: ${dataSummary}. 
      قم بتقديم تقرير تنفيذي احترافي ورسمي باللغة العربية يتضمن:
      1. ملخص هيكلي للبيانات.
      2. أهم 3 ملاحظات إحصائية أو أنماط متكررة.
      3. توصية واحدة لتحسين جودة البيانات أو توظيفها في تحسين الأداء.
      تجنب العبارات الترحيبية واطرح النقاط بشكل مباشر ومختصر.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      setInsights(response.text);
      showToast("تم توليد التقرير الاستكشافي بنجاح");
    } catch (error) {
      console.error(error);
      showToast("تعذر توليد التقرير", 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const autoClean = async () => {
    if (rawData.length === 0) return;
    setIsAutoCleaning(true);
    try {
      const sample = rawData.slice(0, 15);
      const prompt = `أنت نظام آلي مدمج لمعالجة جودة البيانات. هذه عينة: ${JSON.stringify(sample)}.
      قدم بشكل احترافي أهم 3 إجراءات يجب اتخاذها لتنظيف هذه البيانات. 
      أجب باللغة العربية بأسلوب تقني مباشر.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      cleanDups();
      cleanNulls();
      
      showToast("تم الانتهاء من المعالجة الآلية وتطبيق التحسينات الأساسية");
      setInsights(response.text); 
    } catch (error) {
      console.error(error);
      showToast("تعذر تنفيذ المعالجة الآلية", 'error');
    } finally {
      setIsAutoCleaning(false);
    }
  };

  const executeDataQuery = async () => {
    if (!userQuery.trim() || rawData.length === 0) return;
    
    const newMessage = { role: 'user' as const, content: userQuery };
    setChatMessages(prev => [...prev, newMessage]);
    setUserQuery('');
    setIsChatting(true);

    try {
      const sample = rawData.slice(0, 30);
      const context = `عينة من السجلات: ${JSON.stringify(sample)}. 
      أسماء الأعمدة المتاحة: ${columns.join(', ')}.
      عدد السجلات الإجمالي: ${rawData.length}.
      كمساعد تحليل بيانات احترافي، أجب على الاستعلام الخاص بالمستخدم باللغة العربية، بناءً على المعطيات الإحصائية المتاحة.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...chatMessages.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
          })),
          { role: 'user', parts: [{ text: `${context}\n\nالاستعلام: ${userQuery}` }] }
        ]
      });
      
      setChatMessages(prev => [...prev, { role: 'ai', content: response.text }]);
    } catch (error) {
      console.error(error);
      showToast("تعذر معالجة الاستعلام", 'error');
    } finally {
      setIsChatting(false);
    }
  };

  const calculateCorrelation = () => {
    const numericCols = columns.filter(col => 
      rawData.some(r => typeof r[col] === 'number')
    );

    if (numericCols.length < 2) return null;

    const matrix: number[][] = [];
    numericCols.forEach((col1, i) => {
      matrix[i] = [];
      numericCols.forEach((col2, j) => {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          const v1 = rawData.map(r => Number(r[col1]) || 0);
          const v2 = rawData.map(r => Number(r[col2]) || 0);
          
          const n = v1.length;
          const sum1 = v1.reduce((a, b) => a + b, 0);
          const sum2 = v2.reduce((a, b) => a + b, 0);
          const sum1Sq = v1.reduce((a, b) => a + b * b, 0);
          const sum2Sq = v2.reduce((a, b) => a + b * b, 0);
          const pSum = v1.map((v, idx) => v * v2[idx]).reduce((a, b) => a + b, 0);
          
          const num = pSum - (sum1 * sum2 / n);
          const den = Math.sqrt((sum1Sq - sum1 * sum1 / n) * (sum2Sq - sum2 * sum2 / n));
          
          matrix[i][j] = den === 0 ? 0 : Number((num / den).toFixed(2));
        }
      });
    });

    return { labels: numericCols, z: matrix };
  };

  useEffect(() => {
    if (showCorrelation && corrRef.current && rawData.length > 0) {
      const data = calculateCorrelation();
      if (!data) return;

      const trace: any = {
        z: data.z,
        x: data.labels,
        y: data.labels,
        type: 'heatmap',
        colorscale: 'RdBu',
        reversescale: true,
        zmin: -1,
        zmax: 1
      };

      const layout = {
        title: 'مصفوفة الارتباط (Correlation Matrix)',
        font: { family: 'Cairo, sans-serif' },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        margin: { t: 50, b: 100, l: 100, r: 50 }
      };

      Plotly.newPlot(corrRef.current, [trace], layout, { responsive: true });
    }
  }, [showCorrelation, rawData, theme]);

  const columnStats = useMemo(() => {
    if (rawData.length === 0) return [];
    return columns.map(col => {
      const values = rawData.map(r => r[col]).filter(v => typeof v === 'number');
      if (values.length === 0) return { name: col, type: 'text' };
      
      const sum = values.reduce((a, b) => a + b, 0);
      const mean = sum / values.length;
      const sorted = [...values].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const min = Math.min(...values);
      const max = Math.max(...values);
      
      return {
        name: col,
        type: 'number',
        mean: mean.toFixed(2),
        median,
        min,
        max,
        count: values.length
      };
    });
  }, [rawData, columns]);

  const detectOutliers = () => {
    const newAlerts: { col: string, count: number }[] = [];
    columns.forEach(col => {
      const values = rawData.map(r => r[col]).filter(v => typeof v === 'number');
      if (values.length < 10) return;

      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const stdDev = Math.sqrt(values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length);
      
      const outliers = values.filter(v => Math.abs(v - mean) > 3 * stdDev);
      if (outliers.length > 0) {
        newAlerts.push({ col, count: outliers.length });
      }
    });
    setAlerts(newAlerts);
  };

  useEffect(() => {
    if (rawData.length > 0) {
      detectOutliers();
    } else {
      setAlerts([]);
      setInsights(null);
    }
  }, [rawData]);

  const exportData = () => {
    const csv = "\ufeff" + Papa.unparse(rawData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Cleaned_Data.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPlot = () => {
    if (plotRef.current) {
      Plotly.downloadImage(plotRef.current, { format: 'png', width: 1200, height: 800, filename: 'Analytics_Chart' });
    }
  };

  const exportToPDF = async () => {
    const dashboard = document.getElementById('main-content');
    if (!dashboard) return;

    showToast("جاري تحضير التقرير...");
    try {
      const canvas = await html2canvas(dashboard, {
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('Analytics_Report.pdf');
      showToast("تم تصدير التقرير بنجاح");
    } catch (error) {
      console.error(error);
      showToast("تعذر تصدير التقرير", 'error');
    }
  };

  const handleSecondFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        setSecondData(results.data as DataRow[]);
        setSecondCols(results.meta.fields || []);
        if (results.meta.fields?.length) {
          setMergeKey2(results.meta.fields[0]);
        }
      },
    });
  };

  const mergeDatasets = () => {
    if (!mergeKey1 || !mergeKey2 || secondData.length === 0) {
      showToast("يرجى إتمام خطوات الربط الموضحة واختيار الملف", 'error');
      return;
    }

    const merged = rawData.map(r1 => {
      const match = secondData.find(r2 => r1[mergeKey1] === r2[mergeKey2]);
      return { ...r1, ...(match || {}) };
    });

    setRawData(merged);
    const allCols = Array.from(new Set([...columns, ...secondCols]));
    setColumns(allCols);
    showToast("تم الانتهاء من دمج الجداول");
    setSecondData([]);
  };

  const importFromUrl = async () => {
    if (!importUrl.trim()) return;
    setIsImporting(true);
    try {
      let finalUrl = importUrl;
      if (importUrl.includes('docs.google.com/spreadsheets') && !importUrl.includes('export?format=csv')) {
        const sheetId = importUrl.match(/\/d\/(.+?)\//)?.[1];
        if (sheetId) {
          finalUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
        }
      }

      const response = await fetch(finalUrl);
      const text = await response.text();
      
      Papa.parse(text, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          setRawData(results.data as DataRow[]);
          setColumns(results.meta.fields || []);
          showToast("تم جلب البيانات بنجاح");
          setImportUrl('');
        },
      });
    } catch (error) {
      console.error(error);
      showToast("تعذر جلب البيانات من المصدر", 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const runPredictiveAnalysis = async () => {
    if (rawData.length === 0) return;
    setIsPredicting(true);
    try {
      const sample = rawData.slice(0, 50);
      const prompt = `أنت نظام تحليل تنبؤي متقدم. لديك العينة التالية: ${JSON.stringify(sample)}.
      قم بتقديم تقرير احترافي باللغة العربية مقسم إلى:
      1. تحليل للاتجاهات الإحصائية الواضحة بالبيانات.
      2. التوقعات والمخاطر المحتملة المبنية على المعطيات.
      3. مقترحات استراتيجية مبنية على الأرقام.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      setPrediction(response.text);
      showToast("تم الانتهاء من التحليل التنبؤي");
    } catch (error) {
      console.error(error);
      showToast("تعذر إتمام عملية التحليل", 'error');
    } finally {
      setIsPredicting(false);
    }
  };

  const pivotData = useMemo(() => {
    if (!pivotRow || !pivotCol || !pivotVal) return null;

    const rows: string[] = Array.from(new Set(rawData.map(r => String(r[pivotRow]))));
    const cols: string[] = Array.from(new Set(rawData.map(r => String(r[pivotCol]))));
    
    const table: Record<string, Record<string, number>> = {};
    const counts: Record<string, Record<string, number>> = {};

    rows.forEach((r: string) => {
      table[r] = {};
      counts[r] = {};
      cols.forEach((c: string) => {
        table[r][c] = 0;
        counts[r][c] = 0;
      });
    });

    rawData.forEach(r => {
      const rowVal = String(r[pivotRow]);
      const colVal = String(r[pivotCol]);
      const val = Number(r[pivotVal]) || 0;

      if (pivotAgg === 'sum' || pivotAgg === 'avg') {
        table[rowVal][colVal] += val;
      } else if (pivotAgg === 'count') {
        table[rowVal][colVal] += 1;
      }
      counts[rowVal][colVal] += 1;
    });

    if (pivotAgg === 'avg') {
      rows.forEach((r: string) => {
        cols.forEach((c: string) => {
          if (counts[r][c] > 0) {
            table[r][c] = Number((table[r][c] / counts[r][c]).toFixed(2));
          }
        });
      });
    }

    return { rows, cols, table };
  }, [rawData, pivotRow, pivotCol, pivotVal, pivotAgg]);

  const runSystemMonitoring = async () => {
    if (rawData.length < 10) return;
    setIsMonitoring(true);
    try {
      const sample = rawData.slice(-30); 
      const prompt = `أنت نظام لمراقبة جودة البيانات. إليك السجلات الأخيرة: ${JSON.stringify(sample)}.
      تحقق من وجود أي شذوذ إحصائي واضح في الأرقام.
      إذا كان هناك أي خلل واضح، اكتبه في جملة قصيرة واحدة، وإلا أجب بـ "مستقرة".`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const text = response.text;
      if (text && !text.includes("مستقرة")) {
        setMonitoringAlerts(prev => [text, ...prev].slice(0, 5));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsMonitoring(false);
    }
  };

  useEffect(() => {
    if (rawData.length > 20) {
      const timer = setTimeout(runSystemMonitoring, 5000);
      return () => clearTimeout(timer);
    }
  }, [rawData]);

  const navItems = [
    { id: 'dashboard', label: 'لوحة القيادة', icon: LayoutDashboard },
    { id: 'view', label: 'استعراض الجداول', icon: TableIcon },
    { id: 'clean', label: 'معالجة البيانات', icon: Settings2 },
    { id: 'advanced', label: 'التحليل المتقدم', icon: TrendingUp },
    { id: 'export', label: 'إصدار التقارير', icon: Download },
    { id: 'settings', label: 'إعدادات النظام', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Mobile Menu Button */}
      <button 
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-card-bg border border-border rounded-lg shadow-md"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 right-0 z-40 w-64 bg-sidebar text-slate-300 transition-transform duration-300 lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex flex-col h-full py-8">
          <div className="flex items-center justify-center gap-3 mb-12 px-6">
            <Database className="text-primary" size={32} />
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Data System</h1>
          </div>

          <nav className="flex-1 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsSidebarOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-6 py-4 transition-all duration-200",
                  activeTab === item.id 
                    ? "bg-primary/10 text-white border-r-4 border-primary" 
                    : "hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon size={20} />
                <span className="font-bold">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="px-6 mt-auto">
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
              <p className="text-xs text-slate-500 mb-2">حساب المستخدم</p>
              <p className="text-sm font-bold text-white truncate">engzezo943@gmail.com</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main id="main-content" className="flex-1 lg:mr-64 p-4 lg:p-8">
        {activeTab === 'dashboard' && (
          <div className="fade-in space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-3xl font-extrabold">System <span className="text-primary">Analytics</span></h2>
                <p className="text-text-muted mt-1">نظام متكامل لإدارة وتحليل البيانات</p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                  onClick={clearAllData}
                  title="مسح جميع البيانات"
                >
                  <Trash2 size={20} />
                </button>
                <input 
                  type="file" 
                  id="fileInput" 
                  className="hidden" 
                  accept=".csv" 
                  onChange={handleFileUpload}
                />
                <button 
                  className="btn-premium flex items-center gap-2"
                  onClick={() => document.getElementById('fileInput')?.click()}
                >
                  <Upload size={20} />
                  استيراد CSV
                </button>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'إجمالي السجلات', value: stats.rows.toLocaleString(), color: 'border-slate-200' },
                { label: 'عدد الأعمدة', value: stats.cols, color: 'border-primary' },
                { label: 'الخلايا المفقودة', value: stats.nulls.toLocaleString(), color: 'border-amber-500' },
                { label: 'السجلات المكررة', value: stats.dups.toLocaleString(), color: 'border-red-500' },
              ].map((stat, i) => (
                <div key={i} className={cn("premium-card text-center border-t-4", stat.color)}>
                  <p className="text-text-muted text-sm font-medium mb-1">{stat.label}</p>
                  <h3 className="text-3xl font-black">{stat.value}</h3>
                </div>
              ))}
            </div>

            {/* System Alerts */}
            {(alerts.length > 0 || monitoringAlerts.length > 0) && (
              <div className="grid grid-cols-1 gap-4">
                {monitoringAlerts.map((alert, i) => (
                  <div key={`mon-${i}`} className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-700 dark:text-red-400 animate-in slide-in-from-right-4">
                    <Activity size={24} />
                    <div>
                      <p className="font-bold">تنبيه النظام: مراقبة جودة البيانات</p>
                      <p className="text-sm opacity-80">{alert}</p>
                    </div>
                  </div>
                ))}
                {alerts.map((alert, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-700 dark:text-amber-400 animate-in slide-in-from-right-4">
                    <AlertTriangle size={24} />
                    <div>
                      <p className="font-bold">تنبيه إحصائي: قيم متطرفة (Outliers)</p>
                      <p className="text-sm opacity-80">تم رصد {alert.count} قيمة تتجاوز النطاق الطبيعي في عمود <span className="font-mono font-bold">"{alert.col}"</span>.</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Connect Data Section */}
            <div className="premium-card bg-slate-800 text-white">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center">
                    <Activity className="text-primary" size={28} />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold">الربط بقواعد البيانات الخارجية</h4>
                    <p className="text-slate-400 text-sm">استيراد البيانات مباشرة عبر الروابط (Google Sheets, CSV URLs)</p>
                  </div>
                </div>
                <div className="flex w-full md:w-auto gap-2">
                  <input 
                    type="text" 
                    placeholder="أدخل رابط المصدر هنا..."
                    className="flex-1 md:w-80 bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                  />
                  <button 
                    className={cn(
                      "px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-all flex items-center gap-2",
                      isImporting && "opacity-50"
                    )}
                    onClick={importFromUrl}
                    disabled={isImporting}
                  >
                    {isImporting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={20} />}
                    استيراد
                  </button>
                </div>
              </div>
            </div>

            {/* Empty State or Visualization */}
            {rawData.length === 0 ? (
              <div 
                className={cn(
                  "premium-card py-20 flex flex-col items-center justify-center border-2 border-dashed transition-all cursor-pointer",
                  isDragging ? "border-primary bg-primary/10 scale-[1.02]" : "border-primary/30 bg-primary/5 hover:bg-primary/10"
                )}
                onClick={() => document.getElementById('fileInput')?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file && file.name.endsWith('.csv')) {
                    handleFileUpload(file);
                  } else {
                    showToast("يرجى التأكد من استيراد ملف بصيغة CSV المتوافقة", 'error');
                  }
                }}
              >
                <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6">
                  <Database className="text-primary" size={40} />
                </div>
                <h3 className="text-2xl font-bold mb-2">إدراج مصدر البيانات</h3>
                <p className="text-text-muted max-w-md text-center">قم بإفلات ملف CSV هنا، أو اضغط لتحديد الملف من جهازك وبدء عملية التحليل</p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Advanced Insights Section */}
                <div className="premium-card bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                        <Lightbulb className="text-primary" size={24} />
                      </div>
                      <div>
                        <h4 className="text-xl font-bold">التحليل الاستكشافي المتقدم</h4>
                        <p className="text-text-muted text-sm">استخراج الأنماط والملخصات الإحصائية بشكل مباشر</p>
                      </div>
                    </div>
                    <button 
                      className={cn(
                        "btn-premium flex items-center gap-2 px-8",
                        isAnalyzing && "opacity-50 cursor-not-allowed"
                      )}
                      onClick={generateInsights}
                      disabled={isAnalyzing}
                    >
                      {isAnalyzing ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : <BarChart3 size={18} />}
                      {isAnalyzing ? "جاري المعالجة..." : "إصدار التقرير الاستكشافي"}
                    </button>
                  </div>

                  {insights && (
                    <div className="bg-card-bg border border-border rounded-2xl p-6 animate-in fade-in slide-in-from-top-4">
                      <div className="prose prose-slate dark:prose-invert max-w-none whitespace-pre-wrap text-lg leading-relaxed">
                        {insights}
                      </div>
                    </div>
                  )}
                </div>

                {/* Interactive Query Section */}
                <div className="premium-card border-primary/20">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                      <MessageSquare className="text-primary" size={24} />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold">الاستعلام التفاعلي</h4>
                      <p className="text-text-muted text-sm">أدخل استفساراتك للحصول على إحصائيات سريعة ومباشرة من الجدول</p>
                    </div>
                  </div>

                  <div className="bg-bg-body rounded-2xl p-4 h-[400px] flex flex-col border border-border">
                    <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-2">
                      {chatMessages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                          <Database size={48} className="mb-4" />
                          <p>أدخل استعلامك هنا. مثال: "ما هو المعدل العام للمبيعات بناءً على البيانات؟"</p>
                        </div>
                      )}
                      {chatMessages.map((msg, i) => (
                        <div key={i} className={cn(
                          "max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed",
                          msg.role === 'user' 
                            ? "bg-primary text-white mr-auto rounded-br-none" 
                            : "bg-card-bg border border-border ml-auto rounded-bl-none"
                        )}>
                          {msg.content}
                        </div>
                      ))}
                      {isChatting && (
                        <div className="bg-card-bg border border-border ml-auto p-3 rounded-2xl rounded-bl-none flex gap-2">
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.4s]" />
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="اكتب استعلامك التحليلي هنا..."
                        className="flex-1 bg-card-bg border border-border rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary"
                        value={userQuery}
                        onChange={(e) => setUserQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && executeDataQuery()}
                      />
                      <button 
                        className="p-2 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50"
                        onClick={executeDataQuery}
                        disabled={isChatting || !userQuery.trim()}
                      >
                        <Send size={20} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Correlation Matrix Section */}
                <div className="premium-card">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center">
                        <Layers className="text-amber-500" size={24} />
                      </div>
                      <div>
                        <h4 className="text-xl font-bold">مصفوفة الارتباط الإحصائي</h4>
                        <p className="text-text-muted text-sm">مراجعة المعاملات ومستوى الارتباط بين المتغيرات الرقمية</p>
                      </div>
                    </div>
                    <button 
                      className={cn(
                        "px-4 py-2 rounded-xl font-bold transition-all",
                        showCorrelation ? "bg-amber-500 text-white" : "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
                      )}
                      onClick={() => setShowCorrelation(!showCorrelation)}
                    >
                      {showCorrelation ? "إخفاء المصفوفة" : "توليد المصفوفة"}
                    </button>
                  </div>

                  {showCorrelation && (
                    <div className="animate-in fade-in zoom-in-95 duration-300">
                      <div ref={corrRef} className="w-full h-[500px] rounded-xl overflow-hidden bg-bg-body border border-border" />
                    </div>
                  )}
                </div>

                <div className="premium-card">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                  <div className="space-y-2">
                    <label className="text-sm font-bold">المخطط البياني</label>
                    <select 
                      value={chartType}
                      onChange={(e) => setChartType(e.target.value)}
                      className="w-full bg-bg-body border border-border rounded-xl p-2.5 focus:ring-2 focus:ring-primary outline-none"
                    >
                      <option value="scatter3d">مخطط الانتشار ثلاثي الأبعاد</option>
                      <option value="bar">المخطط الشريطي (Bar)</option>
                      <option value="line">المخطط الخطي (Line)</option>
                      <option value="histogram">المدرج التكراري (Histogram)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold">المحور السيني (X)</label>
                    <select 
                      value={xCol}
                      onChange={(e) => setXCol(e.target.value)}
                      className="w-full bg-bg-body border border-border rounded-xl p-2.5 outline-none"
                    >
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold">المحور الصادي (Y)</label>
                    <select 
                      value={yCol}
                      onChange={(e) => setYCol(e.target.value)}
                      className="w-full bg-bg-body border border-border rounded-xl p-2.5 outline-none"
                    >
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold">المحور العيني (Z)</label>
                    <select 
                      value={zCol}
                      onChange={(e) => setZCol(e.target.value)}
                      className="w-full bg-bg-body border border-border rounded-xl p-2.5 outline-none"
                      disabled={chartType !== 'scatter3d'}
                    >
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div ref={plotRef} className="w-full h-[500px] rounded-xl overflow-hidden" />
              </div>
            </div>
          )}
        </div>
      )}

        {activeTab === 'view' && (
          <div className="fade-in space-y-6">
            {rawData.length === 0 ? (
              <div className="premium-card py-20 flex flex-col items-center justify-center text-center space-y-4">
                <TableIcon size={64} className="text-text-muted opacity-20" />
                <h3 className="text-xl font-bold">سجلات البيانات فارغة</h3>
                <p className="text-text-muted">قم برفع البيانات من لوحة القيادة أولاً ليتم عرضها هنا</p>
                <button 
                  className="btn-premium"
                  onClick={() => setActiveTab('dashboard')}
                >
                  الذهاب للوحة القيادة
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <h3 className="text-2xl font-bold">استعراض السجلات وجداول البيانات</h3>
                  <div className="flex gap-2">
                    <button onClick={() => setFilters({})} className="px-4 py-2 text-sm font-bold text-text-muted hover:text-primary transition-colors">
                      إلغاء التصفيات
                    </button>
                    <button onClick={exportData} className="btn-premium flex items-center gap-2">
                      <Download size={18} />
                      تصدير كـ CSV
                    </button>
                  </div>
                </div>

                {/* Slicers / Filters Bar */}
                <div className="premium-card overflow-x-auto">
                  <div className="flex items-center gap-6 min-w-max">
                    <div className="flex items-center gap-2 text-primary font-bold">
                      <Filter size={20} />
                      <span>عوامل التصفية:</span>
                    </div>
                    {columns.slice(0, 5).map(col => (
                      <div key={col} className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{col}</label>
                        <select 
                          value={filters[col] || ''} 
                          onChange={(e) => handleFilterChange(col, e.target.value)}
                          className="bg-bg-body border border-border rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary min-w-[120px]"
                        >
                          <option value="">الكل</option>
                          {getUniqueValues(col).map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="premium-card overflow-hidden">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <h4 className="text-xl font-bold">بيانات الجدول المعتمدة</h4>
                    <div className="relative w-full md:w-72">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                      <input 
                        type="text" 
                        placeholder="البحث ضمن السجلات..."
                        className="w-full bg-bg-body border border-border rounded-xl pr-10 pl-4 py-2.5 outline-none focus:ring-2 focus:ring-primary"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setPage(1);
                        }}
                      />
                    </div>
                  </div>
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-bg-body border-b-2 border-border">
                      {columns.map(c => (
                        <th key={c} className="p-4 font-bold text-sm text-text-muted whitespace-nowrap">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedData.map((row, i) => (
                      <tr key={i} className="hover:bg-primary/5 transition-colors">
                        {columns.map(c => (
                          <td 
                            key={c} 
                            className={cn(
                              "p-4 text-sm font-mono",
                              (row[c] === null || row[c] === undefined || row[c] === "") && "empty-cell"
                            )}
                          >
                            {row[c] ?? '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex justify-center items-center gap-2 mt-8">
                <button 
                  className="p-2 rounded-lg hover:bg-bg-body disabled:opacity-30"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                >
                  <ChevronRight size={20} />
                </button>
                <button 
                  className="px-4 py-2 rounded-lg hover:bg-bg-body disabled:opacity-30 font-bold"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  السابق
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let p = page;
                    if (page <= 3) p = i + 1;
                    else if (page >= totalPages - 2) p = totalPages - 4 + i;
                    else p = page - 2 + i;

                    if (p < 1 || p > totalPages) return null;

                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={cn(
                          "w-10 h-10 rounded-lg font-bold transition-all",
                          page === p ? "bg-primary text-white" : "hover:bg-bg-body"
                        )}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>

                <button 
                  className="px-4 py-2 rounded-lg hover:bg-bg-body disabled:opacity-30 font-bold"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  التالي
                </button>
                <button 
                  className="p-2 rounded-lg hover:bg-bg-body disabled:opacity-30"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                >
                  <ChevronLeft size={20} />
                </button>
              </div>

              {/* Column Analysis Section */}
              <div className="mt-12 space-y-6">
                <div className="flex items-center gap-3">
                  <BarChart3 className="text-primary" size={24} />
                  <h4 className="text-xl font-bold">ملخص وهيكلة الأعمدة</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {columnStats.map((col, i) => (
                    <div key={i} className="p-6 bg-bg-body border border-border rounded-2xl hover:border-primary/30 transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2">
                          {col.type === 'number' ? <BarChart3 size={18} className="text-primary" /> : <FileText size={18} className="text-text-muted" />}
                          <h5 className="font-bold truncate max-w-[150px]">{col.name}</h5>
                        </div>
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                          col.type === 'number' ? "bg-primary/10 text-primary" : "bg-slate-200 text-slate-600"
                        )}>
                          {col.type === 'number' ? 'قيمة رقمية' : 'نص'}
                        </span>
                      </div>
                      
                      {col.type === 'number' ? (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-text-muted">المتوسط:</span>
                            <span className="font-mono font-bold">{col.mean}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-muted">الوسيط:</span>
                            <span className="font-mono font-bold">{col.median}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-muted">النطاق:</span>
                            <span className="font-mono font-bold">{col.min} - {col.max}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-text-muted text-sm py-4">
                          <AlertTriangle size={16} />
                          <span>بيانات غير رقمية - إحصائيات غير متاحة</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            )}
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="fade-in space-y-8">
            {rawData.length === 0 ? (
              <div className="premium-card py-20 flex flex-col items-center justify-center text-center space-y-4">
                <TrendingUp size={64} className="text-text-muted opacity-20" />
                <h3 className="text-xl font-bold">لا يوجد مدخلات للتحليل المتقدم</h3>
                <p className="text-text-muted">يرجى رفع ملف وتوفير سجلات للمنظومة أولاً</p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Predictive Analytics */}
                <div className="premium-card bg-gradient-to-br from-indigo-500/5 to-transparent border-indigo-500/20">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                        <Activity className="text-indigo-500" size={24} />
                      </div>
                      <div>
                        <h4 className="text-xl font-bold">دراسة الاتجاهات والتحليل التنبؤي</h4>
                        <p className="text-text-muted text-sm">حساب التوقعات المستقبلية استناداً إلى المؤشرات الحالية</p>
                      </div>
                    </div>
                    <button 
                      className={cn(
                        "btn-premium bg-indigo-600 hover:bg-indigo-700 flex items-center gap-2",
                        isPredicting && "opacity-50"
                      )}
                      onClick={runPredictiveAnalysis}
                      disabled={isPredicting}
                    >
                      {isPredicting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <LineChart size={18} />}
                      إجراء التحليل التنبؤي
                    </button>
                  </div>
                  {prediction && (
                    <div className="bg-card-bg border border-border rounded-2xl p-6 animate-in fade-in slide-in-from-top-4">
                      <div className="prose prose-slate dark:prose-invert max-w-none whitespace-pre-wrap text-lg leading-relaxed">
                        {prediction}
                      </div>
                    </div>
                  )}
                </div>

                {/* Pivot Table */}
                <div className="premium-card">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                      <PivotIcon className="text-emerald-500" size={24} />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold">الجداول المحورية وتقاطعات البيانات</h4>
                      <p className="text-text-muted text-sm">استخلاص وتلخيص المعلومات بشكل جدولي ديناميكي</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="space-y-2">
                      <label className="text-sm font-bold">محور الصفوف</label>
                      <select value={pivotRow} onChange={(e) => setPivotRow(e.target.value)} className="w-full bg-bg-body border border-border rounded-xl p-2.5 outline-none">
                        <option value="">تحديد السمة...</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold">محور الأعمدة</label>
                      <select value={pivotCol} onChange={(e) => setPivotCol(e.target.value)} className="w-full bg-bg-body border border-border rounded-xl p-2.5 outline-none">
                        <option value="">تحديد السمة...</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold">القيم المحسوبة</label>
                      <select value={pivotVal} onChange={(e) => setPivotVal(e.target.value)} className="w-full bg-bg-body border border-border rounded-xl p-2.5 outline-none">
                        <option value="">تحديد الحقل...</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold">الدالة الرياضية</label>
                      <select value={pivotAgg} onChange={(e: any) => setPivotAgg(e.target.value)} className="w-full bg-bg-body border border-border rounded-xl p-2.5 outline-none">
                        <option value="sum">المجموع (Sum)</option>
                        <option value="count">العدد (Count)</option>
                        <option value="avg">المتوسط (Average)</option>
                      </select>
                    </div>
                  </div>

                  {pivotData && (
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="bg-bg-body border-b-2 border-border">
                            <th className="p-4 font-bold text-sm text-primary bg-primary/5">{pivotRow} \ {pivotCol}</th>
                            {pivotData.cols.map(c => (
                              <th key={c} className="p-4 font-bold text-sm text-text-muted">{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {pivotData.rows.map(r => (
                            <tr key={r} className="hover:bg-primary/5 transition-colors">
                              <td className="p-4 font-bold bg-primary/5 text-sm">{r}</td>
                              {pivotData.cols.map(c => (
                                <td key={c} className="p-4 text-sm font-mono">{pivotData.table[r][c]}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Data Merging */}
                <div className="premium-card">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center">
                      <GitMerge className="text-orange-500" size={24} />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold">ربط ودمج الجداول</h4>
                      <p className="text-text-muted text-sm">دمج ملفين بناءً على المعرفات المشتركة</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h5 className="font-bold">المرحلة الأولى: إرفاق الجدول الإضافي</h5>
                      <div className="relative group">
                        <input 
                          type="file" 
                          accept=".csv" 
                          onChange={handleSecondFileUpload} 
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                        />
                        <div className="p-8 border-2 border-dashed border-border rounded-2xl group-hover:border-orange-500 group-hover:bg-orange-500/5 transition-all flex flex-col items-center justify-center text-center">
                          <Upload className="text-orange-500 mb-2" size={32} />
                          <p className="text-sm font-bold">حدد الملف للإضافة</p>
                          <p className="text-xs text-text-muted mt-1">تنسيق CSV المعتمد فقط</p>
                        </div>
                      </div>
                      {secondData.length > 0 && (
                        <div className="flex items-center gap-2 text-sm text-green-500 font-bold bg-green-500/10 p-2 rounded-lg">
                          <CheckCircle2 size={16} />
                          تم إدراج {secondData.length} سجلاً بنجاح
                        </div>
                      )}
                    </div>
                    <div className="space-y-4">
                      <h5 className="font-bold">المرحلة الثانية: تخصيص محددات الدمج</h5>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold">حقل الجدول الرئيسي</label>
                          <select value={mergeKey1} onChange={(e) => setMergeKey1(e.target.value)} className="w-full bg-bg-body border border-border rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-orange-500">
                            <option value="">تحديد...</option>
                            {columns.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold">حقل الجدول المرفق</label>
                          <select value={mergeKey2} onChange={(e) => setMergeKey2(e.target.value)} className="w-full bg-bg-body border border-border rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-orange-500">
                            <option value="">تحديد...</option>
                            {secondCols.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                      <button 
                        onClick={mergeDatasets} 
                        className="w-full py-4 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                      >
                        <GitMerge size={20} />
                        تطبيق إجراء الدمج
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'clean' && (
          <div className="fade-in space-y-8">
            {rawData.length === 0 ? (
              <div className="premium-card py-20 flex flex-col items-center justify-center text-center space-y-4">
                <Settings2 size={64} className="text-text-muted opacity-20" />
                <h3 className="text-xl font-bold">لم يتم رصد جداول قابلة للمعالجة</h3>
                <p className="text-text-muted">الرجاء العودة وتوفير السجلات المراد هيكلتها</p>
                <button 
                  className="btn-premium"
                  onClick={() => setActiveTab('dashboard')}
                >
                  الذهاب للوحة القيادة
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="premium-card space-y-6">
                <h5 className="text-xl font-bold flex items-center gap-2">
                  <Filter className="text-primary" size={20} />
                  المعالجة والتهيئة
                </h5>
                <div className="space-y-3">
                  <button 
                    className={cn(
                      "w-full py-4 px-4 rounded-xl bg-primary text-white font-bold flex items-center justify-center gap-2 hover:bg-primary-dark transition-all shadow-lg",
                      isAutoCleaning && "opacity-50"
                    )}
                    onClick={autoClean}
                    disabled={isAutoCleaning}
                  >
                    {isAutoCleaning ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : <Settings2 size={20} />}
                    تنفيذ التنسيق الآلي الموحد
                  </button>
                  <button 
                    className="w-full py-3 px-4 rounded-xl border-2 border-red-500/20 text-red-500 font-bold hover:bg-red-500 hover:text-white transition-all"
                    onClick={cleanDups}
                  >
                    إزالة السجلات المكررة
                  </button>
                  <button 
                    className="w-full py-3 px-4 rounded-xl border-2 border-red-500/20 text-red-500 font-bold hover:bg-red-500 hover:text-white transition-all"
                    onClick={cleanNulls}
                  >
                    استبعاد السجلات المفقودة بالكامل
                  </button>
                </div>
              </div>

              <div className="lg:col-span-2 premium-card space-y-6">
                <h5 className="text-xl font-bold flex items-center gap-2">
                  <CheckCircle2 className="text-green-500" size={20} />
                  استيفاء وتعبئة البيانات (Data Imputation)
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold">تحديد العمود المستهدف</label>
                    <select 
                      value={fillCol}
                      onChange={(e) => setFillCol(e.target.value)}
                      className="w-full bg-bg-body border border-border rounded-xl p-3 outline-none"
                    >
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold">آلية الاستيفاء</label>
                    <select 
                      value={fillMethod}
                      onChange={(e) => setFillMethod(e.target.value)}
                      className="w-full bg-bg-body border border-border rounded-xl p-3 outline-none"
                    >
                      <option value="mean">المتوسط الحسابي (للقيم الرقمية)</option>
                      <option value="median">الوسيط (للقيم الرقمية)</option>
                      <option value="zero">تعويض بصفر</option>
                      <option value="custom">إدخال قيمة تعويضية ثابتة</option>
                    </select>
                  </div>
                  {fillMethod === 'custom' && (
                    <div className="space-y-2">
                      <label className="text-sm font-bold">القيمة التعويضية</label>
                      <input 
                        type="text" 
                        className="w-full bg-bg-body border border-border rounded-xl p-3 outline-none"
                        placeholder="ضع القيمة المطلوبة..."
                        value={customVal}
                        onChange={(e) => setCustomVal(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="md:col-span-2 flex justify-end">
                    <button 
                      className="btn-premium px-12"
                      onClick={fillValues}
                    >
                      تطبيق القاعدة
                    </button>
                  </div>
                </div>
              </div>

              {/* Advanced Engineering Section */}
              <div className="premium-card space-y-8 col-span-1 lg:col-span-3">
                <h5 className="text-xl font-bold flex items-center gap-2">
                  <Cpu className="text-primary" size={20} />
                  هندسة المتغيرات وتهيئة البنية
                </h5>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  {/* Type Conversion */}
                  <div className="space-y-4">
                    <p className="font-bold text-sm text-text-muted">التحكم في أنماط الحقول الأساسية</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <select 
                        value={convertCol}
                        onChange={(e) => setConvertCol(e.target.value)}
                        className="bg-bg-body border border-border rounded-xl p-3 outline-none"
                      >
                        <option value="">انتقاء الحقل...</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select 
                        value={convertType}
                        onChange={(e) => setConvertType(e.target.value)}
                        className="bg-bg-body border border-border rounded-xl p-3 outline-none"
                      >
                        <option value="number">تنسيق رقمي</option>
                        <option value="string">تنسيق نصي</option>
                      </select>
                    </div>
                    <button 
                      className="w-full py-3 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary hover:text-white transition-all"
                      onClick={convertColumnType}
                    >
                      اعتماد تغيير النوع
                    </button>
                  </div>

                  {/* Feature Engineering */}
                  <div className="space-y-4">
                    <p className="font-bold text-sm text-text-muted">توليد متغيرات واشتقاق ميزات إضافية</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <input 
                        type="text" 
                        placeholder="تعريف مسمى الميزة..."
                        className="bg-bg-body border border-border rounded-xl p-3 outline-none"
                        value={newColName}
                        onChange={(e) => setNewColName(e.target.value)}
                      />
                      <select 
                        value={operation}
                        onChange={(e) => setOperation(e.target.value)}
                        className="bg-bg-body border border-border rounded-xl p-3 outline-none"
                      >
                        <option value="add">عملية الجمع (+)</option>
                        <option value="sub">عملية الطرح (-)</option>
                        <option value="mul">عملية الضرب (×)</option>
                        <option value="div">عملية القسمة (÷)</option>
                      </select>
                      <select 
                        value={opCol1}
                        onChange={(e) => setOpCol1(e.target.value)}
                        className="bg-bg-body border border-border rounded-xl p-3 outline-none"
                      >
                        <option value="">المتغير الأولي...</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select 
                        value={opCol2}
                        onChange={(e) => setOpCol2(e.target.value)}
                        className="bg-bg-body border border-border rounded-xl p-3 outline-none"
                      >
                        <option value="">المتغير الثاني...</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <button 
                      className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:shadow-lg transition-all"
                      onClick={createFeature}
                    >
                      إضافة الميزة للنظام
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

        {activeTab === 'export' && (
          <div className="fade-in flex items-center justify-center min-h-[60vh]">
            {rawData.length === 0 ? (
              <div className="premium-card max-w-2xl w-full text-center py-16 space-y-8">
                <Download size={64} className="text-text-muted opacity-20 mx-auto" />
                <h3 className="text-xl font-bold">لا يوجد مدخلات للإصدار</h3>
                <p className="text-text-muted">الرجاء تنفيذ خطوات المعالجة والتحليل قبل طلب التقارير</p>
                <button 
                  className="btn-premium"
                  onClick={() => setActiveTab('dashboard')}
                >
                  العودة للشاشة الرئيسية
                </button>
              </div>
            ) : (
              <div className="premium-card max-w-2xl w-full text-center py-16 space-y-8">
              <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Download className="text-primary" size={48} />
              </div>
              <div className="space-y-2">
                <h3 className="text-3xl font-black">خيارات إصدار المخرجات</h3>
                <p className="text-text-muted text-lg">البيانات والمعلومات أصبحت مُعدة للاستخراج ضمن أنماط متوافقة مع أنظمة العمل المختلفة.</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <button 
                  className="btn-premium px-10 py-4 text-lg w-full sm:w-auto"
                  onClick={exportData}
                >
                  إصدار الجداول (CSV)
                </button>
                <button 
                  className="px-10 py-4 text-lg font-bold border-2 border-primary text-primary rounded-xl hover:bg-primary hover:text-white transition-all w-full sm:w-auto"
                  onClick={exportPlot}
                >
                  حفظ الرسم البياني (PNG)
                </button>
                <button 
                  className="px-10 py-4 text-lg font-bold bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition-all w-full sm:w-auto flex items-center justify-center gap-2"
                  onClick={exportToPDF}
                >
                  <FileText size={20} />
                  وثيقة التقرير (PDF)
                </button>
              </div>
            </div>
          )}
        </div>
      )}

        {activeTab === 'settings' && (
          <div className="fade-in space-y-8">
            <div className="premium-card space-y-8">
              <h5 className="text-xl font-bold">إعدادات المنصة وإدارة المظهر</h5>
              
              <div className="flex items-center justify-between p-6 bg-bg-body rounded-2xl border border-border">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-card-bg rounded-xl flex items-center justify-center border border-border">
                    {theme === 'dark' ? <Moon className="text-primary" /> : <Sun className="text-amber-500" />}
                  </div>
                  <div>
                    <p className="font-bold text-lg">الوضع الليلي المتوافق (Dark Mode)</p>
                    <p className="text-text-muted text-sm">ضبط وتخصيص هوية التطبيق لتلائم الراحة البصرية</p>
                  </div>
                </div>
                <button 
                  onClick={toggleTheme}
                  className={cn(
                    "w-14 h-8 rounded-full p-1 transition-colors duration-300",
                    theme === 'dark' ? "bg-primary" : "bg-slate-300"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300",
                    theme === 'dark' ? "-translate-x-6" : "translate-x-0"
                  )} />
                </button>
              </div>

              <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10">
                <p className="font-bold text-primary mb-2">السجلات والنظام</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <p className="text-text-muted">نسخة التطبيق:</p>
                  <p className="font-mono">v2.4.0-Enterprise</p>
                  <p className="text-text-muted">حالة التحديث المعياري:</p>
                  <p className="font-mono">محدّث ومفعل - أحدث توافق</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Toast Notification */}
      {toast && (
        <div className={cn(
          "fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4",
          toast.type === 'success' ? "bg-green-600 text-white" : "bg-red-600 text-white"
        )}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <X size={20} />}
          <span className="font-bold">{toast.message}</span>
        </div>
      )}
    </div>
  );
}