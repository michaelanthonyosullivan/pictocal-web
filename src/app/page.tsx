"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { signIn, signOut, useSession } from "next-auth/react";
import imageCompression from 'browser-image-compression';

// --- CONFIGURATION ---

const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const DEFAULT_IMAGES = [
  "/Jan.jpg", "/Feb.jpg", "/Mar.jpg", "/Apr.jpg",
  "/May.jpg", "/Jun.jpg", "/Jul.jpg", "/Aug.jpg",
  "/Sep.jpg", "/Oct.jpg", "/Nov.jpg", "/Dec.jpg"
];

// --- HELPER FUNCTIONS ---

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

const getFirstDayOfMonth = (year: number, month: number) => {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
};

const formatDate = (d: number, m: number, y: number) => {
  return `${d.toString().padStart(2, '0')}/${(m + 1).toString().padStart(2, '0')}/${y}`;
};

const getDateKey = (d: number, m: number, y: number) => {
  return `${y}-${(m + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
};

const getWeekNumber = (d: Date) => {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

// --- ICONS (SVG) ---
const ChevronLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-green-900 hover:text-green-700">
    <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-green-900 hover:text-green-700">
    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DoubleChevronLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-green-900 hover:text-green-700">
    <path d="M18.5 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M11.5 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DoubleChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-green-900 hover:text-green-700">
    <path d="M5.5 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12.5 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// --- MAIN COMPONENT ---

export default function PictocalApp() {
  // --- STATE ---
  const { data: session, status } = useSession();
  const [currentDate, setCurrentDate] = useState(new Date());

  const [selectedDay, setSelectedDay] = useState(new Date().getDate());

  const [noteText, setNoteText] = useState("");
  const [db, setDb] = useState<Record<string, string>>({});
  const [recordFound, setRecordFound] = useState(false);

  const [imageSrc, setImageSrc] = useState("/Jan.jpg");
  const [customImages, setCustomImages] = useState<Record<number, string>>({});
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const [isDirty, setIsDirty] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived Values
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayOfWeek = getFirstDayOfMonth(currentYear, currentMonth);

  // --- GRID LOGIC ---
  interface CalendarCell {
    day: number;
    type: 'prev' | 'current' | 'next';
    key: string;
  }

  const calendarCells: CalendarCell[] = [];
  const prevMonthDays = getDaysInMonth(currentYear, currentMonth - 1);

  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push({
      day: prevMonthDays - firstDayOfWeek + 1 + i,
      type: 'prev',
      key: `prev-${i}`
    });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push({
      day: i,
      type: 'current',
      key: `curr-${i}`
    });
  }
  const remainingCells = 42 - calendarCells.length;
  for (let i = 1; i <= remainingCells; i++) {
    calendarCells.push({
      day: i,
      type: 'next',
      key: `next-${i}`
    });
  }

  // --- INITIALIZATION ---
  useEffect(() => {
    document.title = "Pictocal Calendar & Diary";
    // Initialize default image
    const startMonth = new Date().getMonth();
    setImageSrc(DEFAULT_IMAGES[startMonth]);
  }, []);

  // --- AUTO-FETCH LOGIC (Step 4) ---
  const loadData = useCallback(async () => {
    if (status !== "authenticated") return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/storage');

      if (response.ok) {
        const json = await response.json();
        if (json.db) {
          setDb(json.db);
          if (json.customImages) {
            setCustomImages(json.customImages);
          }
          setHasLoaded(true);
          setIsDirty(false);
        }
      }
    } catch (error) {
      console.error("Auto-fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (status === "authenticated" && !hasLoaded) {
      loadData();
    }
  }, [status, hasLoaded, loadData]);

  // --- LOGIC: Switch Image ---
  useEffect(() => {
    const customImg = customImages[currentMonth];
    if (customImg) {
      setImageSrc(customImg);
    } else {
      setImageSrc(DEFAULT_IMAGES[currentMonth]);
    }
  }, [currentMonth, customImages]);

  // --- LOGIC: Load Date Data ---
  useEffect(() => {
    const key = getDateKey(selectedDay, currentMonth, currentYear);
    const existingNote = db[key];

    if (existingNote) {
      setRecordFound(true);
      setNoteText(existingNote);
    } else {
      setRecordFound(false);
      setNoteText("");
    }
  }, [selectedDay, currentMonth, currentYear, db]);

  // --- HANDLERS ---

  const changeMonth = (offset: number, day: number = 1) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    setCurrentDate(newDate);
    setSelectedDay(day);
  };

  const changeWeek = (offset: number) => {
    const currentSelectedDate = new Date(currentYear, currentMonth, selectedDay);
    currentSelectedDate.setDate(currentSelectedDate.getDate() + (offset * 7));
    setCurrentDate(currentSelectedDate);
    setSelectedDay(currentSelectedDate.getDate());
  };

  const handleDayClick = (day: number, type: string) => {
    if (type === 'current') {
      setSelectedDay(day);
    } else if (type === 'prev') {
      changeMonth(-1, day);
    } else if (type === 'next') {
      changeMonth(1, day);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNoteText(e.target.value);
    setIsDirty(true);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDay(today.getDate());
  };

  // --- FEATURE: SMART BACKUP (SAVE) ---
  const handleExportBackup = async () => {
    if (status !== "authenticated") {
      alert("Please login to save.");
      return;
    }

    // 1. Get the exact date the user is currently looking at
    const dateKey = getDateKey(selectedDay, currentMonth, currentYear);
    const actualDate = new Date(currentYear, currentMonth, selectedDay);

    // 2. Package the exact data the backend is looking for
    const dataToSave = {
      entryDate: actualDate.toISOString(),
      content: db[dateKey] || "",
      imageUrl: customImages[currentMonth] || DEFAULT_IMAGES[currentMonth]
    };

    try {
      // 3. Send it to our new storage route
      const response = await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave),
      });

      if (response.ok) {
        alert("Diary Saved Successfully!");
        setIsDirty(false);
      } else {
        alert("Server Error: Failed to save file.");
      }
    } catch (error) {
      alert("Network Error: Could not reach server.");
    }
  };

  // --- FEATURE: MAKE PDF ---
  const handleMakePDF = async () => {
    const element = document.getElementById('capture-target');
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = (pdfHeight - imgHeight * ratio) / 2;
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`Pictocal-${monthNames[currentMonth]}-${currentYear}.pdf`);
    } catch (error) { alert("Failed to generate PDF."); }
  };

  // --- BUTTON LOGIC (LOCAL STATE UPDATE) ---
  const updateLocalState = (newDb: Record<string, string>) => {
    setDb(newDb);
    setIsDirty(true); // Mark as dirty so user knows to Save
  }

  const handleAdd = () => {
    if (noteText.trim() !== "") {
      const key = getDateKey(selectedDay, currentMonth, currentYear);
      const newDb = { ...db, [key]: noteText };
      updateLocalState(newDb);
    }
  };

  const handleConfirm = () => {
    const key = getDateKey(selectedDay, currentMonth, currentYear);
    if (noteText.trim() !== "") {
      const newDb = { ...db, [key]: noteText };
      updateLocalState(newDb);
    } else { handleDelete(); }
  };

  const handleDelete = () => {
    if (window.confirm("Delete Record?")) {
      const key = getDateKey(selectedDay, currentMonth, currentYear);
      const newDb = { ...db };
      delete newDb[key];
      updateLocalState(newDb);
      setNoteText("");
    }
  };

  // --- DRAG & DROP (IMAGE UPLOAD) ---
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingFile(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingFile(false); };
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);

    if (status !== "authenticated") {
      alert("Please login to upload images.");
      return;
    }

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        try {
          // Compress Image (Now set to high quality 3MB / 4K limit)
          const options = { maxSizeMB: 3, maxWidthOrHeight: 3840, useWebWorker: true, initialQuality: 1 };
          const compressedFile = await imageCompression(file, options);

          // Upload to Vercel Blob
          const response = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
            method: 'POST',
            body: compressedFile,
          });

          if (!response.ok) throw new Error('Upload failed');

          const blob = await response.json();
          const url = blob.url;

          // Update State
          setImageSrc(url);
          setCustomImages(prev => {
            const updated = { ...prev, [currentMonth]: url };
            setIsDirty(true);
            return updated;
          });

        } catch (error) {
          console.error(error);
          alert("Failed to upload image.");
        }
      } else { alert("Please drop an image file."); }
    }
  }, [currentMonth, status]);

  const savedText = db[getDateKey(selectedDay, currentMonth, currentYear)] || "";
  const isAddEnabled = !recordFound && noteText.trim().length > 0;
  const isConfirmEnabled = recordFound && noteText.trim().length > 0 && noteText !== savedText;
  const isDeleteEnabled = recordFound;

  const loadSaveBtnClass = (active: boolean, color: string) => `
    text-[10px] px-2 py-1 rounded font-bold shadow-md border transition-colors
    ${active
      ? `${color === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-500 border-yellow-700' : 'bg-green-600 hover:bg-green-500 border-green-700'} text-white cursor-pointer`
      : 'bg-gray-400 text-gray-200 border-gray-500 cursor-not-allowed'}
  `;

  return (
    <div className="h-screen w-full bg-[#1a365d] flex flex-col p-2 overflow-hidden font-sans box-border">

      {/* HEADER TABS & BACKUP CONTROLS */}
      <div className="h-8 flex-none w-full flex items-end justify-between px-4 mb-0 z-10">
        <div className="flex items-end space-x-1">
          <div className="bg-white px-6 py-1 rounded-t-lg text-sm font-bold text-gray-800 shadow-sm cursor-pointer border-t border-l border-r border-gray-400 relative top-[1px]">
            Calendar Page
          </div>
          <div className="bg-[#2c5282] px-6 py-1 rounded-t-lg text-sm font-bold text-white shadow-sm cursor-pointer opacity-80 hover:opacity-100">
            Data Page
          </div>
        </div>
        <div className="flex space-x-2 pb-1 items-center">

          {status === "loading" ? (
            <span className="text-white text-xs">Loading...</span>
          ) : status === "authenticated" ? (
            <>
              <span className="text-white text-xs mr-2">Hello, {session.user?.email}</span>
              <button onClick={() => signOut()} className="bg-red-600 text-white text-[10px] px-2 py-1 rounded font-bold hover:bg-red-500">Sign Out</button>
            </>
          ) : (
            <button onClick={() => signIn()} className="bg-blue-600 text-white text-[10px] px-2 py-1 rounded font-bold hover:bg-blue-500">Sign In</button>
          )}

          <button
            onClick={handleExportBackup}
            disabled={!isDirty || status !== "authenticated"}
            className={loadSaveBtnClass(isDirty && status === "authenticated", 'green')}
          >
            {isDirty ? "Save Changes" : "Saved"}
          </button>
        </div>
      </div>

      {/* APP FRAME */}
      <div id="capture-target" className="flex-1 w-full min-w-0 min-h-0 bg-[#1a365d] border-4 border-[#1a365d] rounded-lg overflow-hidden shadow-2xl flex flex-col relative">
        <PanelGroup direction="horizontal" className="h-full w-full">

          {/* --- LEFT PANEL --- */}
          <Panel defaultSize={55} minSize={30} collapsible={false} className="bg-white flex flex-col min-w-0">
            <div
              className={`flex-1 w-full relative overflow-hidden bg-black flex items-center justify-center transition-colors ${isDraggingFile ? 'bg-gray-700' : 'bg-black'}`}
              onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
            >
              <img src={imageSrc} alt="Landscape" className="w-full h-full object-contain select-none block" onError={(e) => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/800x600?text=Image+Not+Found"; }} />
              {isDraggingFile && (
                <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20 border-4 border-blue-400 border-dashed z-50">
                  <span className="text-white font-bold text-xl bg-black/50 px-4 py-2 rounded">Drop Image to Upload</span>
                </div>
              )}
            </div>

            <div className="h-10 flex-none bg-[#1a365d] flex items-center justify-between px-2" data-html2canvas-ignore="true">
              <button onClick={handleMakePDF} className="bg-white text-black text-xs font-bold px-3 py-1 rounded shadow hover:bg-gray-200">
                Make PDF
              </button>
              <button onClick={() => window.open('https://www.bbc.co.uk/', '_blank')} className="bg-[#2d3748] text-white text-xs font-bold px-3 py-1 rounded border border-gray-500 hover:bg-gray-700">
                BBC Home Page
              </button>
            </div>
          </Panel>

          {/* SPLITTER */}
          <PanelResizeHandle className="w-3 flex flex-col justify-start z-50 relative focus:outline-none">
            <div className="w-full bg-[#1a365d] hover:bg-[#2c5282] transition-colors flex items-center justify-center relative" style={{ height: 'calc(100% - 2.5rem)' }}>
              <div className="h-8 w-1 bg-blue-400/30 rounded"></div>
            </div>
          </PanelResizeHandle>

          {/* --- RIGHT PANEL --- */}
          <Panel minSize={30} collapsible={false} className="flex flex-col min-w-0">
            <PanelGroup direction="vertical" className="h-full">

              {/* CALENDAR */}
              <Panel defaultSize={60} minSize={30} collapsible={false} className="flex flex-col min-h-0">
                <div className="bg-[#a7f3d0] h-8 flex-none flex items-center justify-between px-2 border-b border-green-600 select-none">
                  {/* Previous Year */}
                  <button onClick={() => changeMonth(-12)} className="px-1 flex items-center justify-center focus:outline-none">
                    <DoubleChevronLeft />
                  </button>

                  {/* Month Navigation Group */}
                  <div className="flex items-center space-x-1">
                    <button onClick={() => changeMonth(-1)} className="px-1 flex items-center justify-center focus:outline-none">
                      <ChevronLeft />
                    </button>
                    <span className="font-bold text-green-900 truncate px-2 min-w-[140px] text-center text-lg leading-none pt-0.5">
                      {monthNames[currentMonth]} {currentYear}
                    </span>
                    <button onClick={() => changeMonth(1)} className="px-1 flex items-center justify-center focus:outline-none">
                      <ChevronRight />
                    </button>
                  </div>

                  {/* Next Year */}
                  <button onClick={() => changeMonth(12)} className="px-1 flex items-center justify-center focus:outline-none">
                    <DoubleChevronRight />
                  </button>
                </div>

                <div className="flex-1 w-full bg-[#d1fae5] p-2 flex flex-col min-h-0 select-none overflow-hidden">
                  <div className="grid grid-cols-7 gap-1 text-center font-bold text-green-900 mb-1 flex-none">
                    {daysOfWeek.map(d => <div key={d}>{d}</div>)}
                  </div>

                  <div className="flex-1 grid grid-cols-7 grid-rows-6 gap-1 text-center text-sm min-h-0">
                    {calendarCells.map((cell) => {
                      let cellMonth = currentMonth;
                      let cellYear = currentYear;

                      if (cell.type === 'prev') {
                        cellMonth = currentMonth - 1;
                        if (cellMonth < 0) {
                          cellMonth = 11;
                          cellYear -= 1;
                        }
                      } else if (cell.type === 'next') {
                        cellMonth = currentMonth + 1;
                        if (cellMonth > 11) {
                          cellMonth = 0;
                          cellYear += 1;
                        }
                      }

                      const hasData = !!db[getDateKey(cell.day, cellMonth, cellYear)];
                      const isSelected = cell.type === 'current' && selectedDay === cell.day;

                      let textColor = 'text-green-800';
                      if (cell.type !== 'current') textColor = 'text-[#7da993]';

                      const cursor = 'cursor-pointer hover:bg-green-200';

                      let bgClass = 'border-transparent';
                      if (isSelected) {
                        bgClass = 'bg-cyan-400 text-black font-bold border-cyan-600 shadow-sm';
                        textColor = 'text-black';
                      }

                      return (
                        <div
                          key={cell.key}
                          onClick={() => handleDayClick(cell.day, cell.type)}
                          className={`
                              relative flex items-center justify-center rounded border transition-colors
                              ${bgClass} ${cursor} ${textColor}
                            `}
                        >
                          <span className="z-10 relative">{cell.day}</span>
                          {hasData && !isSelected && (
                            <div className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div onClick={goToToday} className="h-6 flex-none bg-[#bfdbfe] flex items-center justify-center text-xs text-gray-700 font-bold border-t border-blue-300 cursor-pointer hover:bg-blue-300 hover:text-blue-900 transition-colors" title="Click to go to Today">
                  Today is {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </Panel>

              {/* SPLITTER */}
              <PanelResizeHandle className="h-3 bg-[#1a365d] flex items-center justify-center cursor-row-resize hover:bg-[#2c5282] transition-colors z-50 relative focus:outline-none">
                <div className="w-8 h-1 bg-blue-400/30 rounded"></div>
              </PanelResizeHandle>

              {/* DATA ENTRY */}
              <Panel minSize={20} collapsible={false} className="flex flex-col bg-[#bfdbfe] min-h-0">
                <div className="bg-[#1a365d] h-8 flex-none grid grid-cols-[1fr_auto_1fr] items-center px-2">
                  <div></div>
                  <div className="flex items-center justify-center space-x-1">
                    <button onClick={() => changeWeek(-1)} className="text-white font-bold hover:text-blue-300 px-2">◀</button>
                    <span className="bg-[#3182ce] text-white text-xs px-4 py-0.5 rounded border border-blue-400 text-center min-w-[90px] shadow-inner">
                      Week No {getWeekNumber(new Date(currentYear, currentMonth, selectedDay))}
                    </span>
                    <button onClick={() => changeWeek(1)} className="text-white font-bold hover:text-blue-300 px-2">▶</button>
                  </div>
                  <div className="flex justify-end">
                    <span className="bg-white text-black text-xs px-2 py-0.5 rounded shadow-sm whitespace-nowrap">
                      {formatDate(selectedDay, currentMonth, currentYear)}
                    </span>
                  </div>
                </div>

                <textarea
                  value={noteText}
                  onChange={handleTextChange}
                  className={`flex-1 w-full bg-[#bfdbfe] p-2 text-sm resize-none outline-none min-h-0 placeholder-gray-500/50 ${noteText !== savedText ? 'text-gray-500 italic' : 'text-gray-900 font-medium'}`}
                  placeholder="No notes for this day..."
                />
              </Panel>

            </PanelGroup>

            <div className="h-10 flex-none bg-[#1a365d] flex items-center justify-end px-2 space-x-2" data-html2canvas-ignore="true">
              <button onClick={handleDelete} disabled={!isDeleteEnabled} className={`text-xs font-bold px-3 py-1 rounded shadow border ${isDeleteEnabled ? 'bg-white text-black hover:bg-gray-100 border-gray-400 cursor-pointer' : 'bg-gray-400 text-gray-700 border-gray-500 cursor-not-allowed'}`}>Delete</button>
              <div className="flex-1"></div>
              <button onClick={handleAdd} disabled={!isAddEnabled} className={`text-xs font-bold px-3 py-1 rounded shadow border ${isAddEnabled ? 'bg-white text-black hover:bg-gray-100 border-gray-400 cursor-pointer' : 'bg-gray-400 text-gray-700 border-gray-500 cursor-not-allowed'}`}>Add</button>
              <button onClick={handleConfirm} disabled={!isConfirmEnabled} className={`text-xs font-bold px-3 py-1 rounded shadow border ${isConfirmEnabled ? 'bg-white text-black hover:bg-gray-100 border-gray-400 cursor-pointer' : 'bg-gray-400 text-gray-700 border-gray-500 cursor-not-allowed'}`}>Confirm</button>
            </div>

          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}