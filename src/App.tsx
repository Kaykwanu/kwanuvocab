import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BookOpen,
  Award,
  Bookmark,
  BookmarkCheck,
  Star,
  Plus,
  Search,
  RotateCcw,
  CheckCircle2,
  PlusCircle,
  Trash2,
  HelpCircle,
  Filter,
  Sparkles,
  BookMarked,
  BrainCircuit,
  GraduationCap,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Check,
  X,
  RefreshCw,
  Clock,
  LayoutGrid,
  Heart,
  Undo,
  Quote,
  Database,
  AlertTriangle,
  Play,
  Pause
} from "lucide-react";
import { GREWord, AppMode, WordCategory, RootPart, QuizOption } from "./types";

// --- CSV PARSING UTILITY ---
function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let current = "";
  let insideQuote = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (insideQuote) {
      if (char === '"') {
        if (nextChar === '"') {
          current += '"';
          i++;
        } else {
          insideQuote = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        insideQuote = true;
      } else if (char === ',') {
        row.push(current);
        current = "";
      } else if (char === '\r' || char === '\n') {
        row.push(current);
        current = "";
        if (row.length > 1 || row[0] !== "") {
          result.push(row);
        }
        row = [];
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
      } else {
        current += char;
      }
    }
  }
  if (row.length > 0 || current !== "") {
    row.push(current);
    result.push(row);
  }
  return result;
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getDayRange(day: number): { start: number; end: number } {
  switch (day) {
    case 1: return { start: 1, end: 86 };
    case 2: return { start: 87, end: 172 };
    case 3: return { start: 173, end: 258 };
    case 4: return { start: 259, end: 344 };
    case 5: return { start: 345, end: 430 };
    case 6: return { start: 431, end: 516 };
    case 7: return { start: 517, end: 600 };
    default: return { start: 1, end: 999999 };
  }
}

// Sparkle/Highlight vocabulary word in example sentences case-insensitively
function formatExampleSentence(sentence: string, word: string) {
  if (!sentence) return null;
  if (!word) return <span>{sentence}</span>;
  
  const escapedWord = word.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!escapedWord) return <span>{sentence}</span>;

  // Match the word at word boundaries and any word character suffixes (e.g., obdurately, obdurate)
  const regex = new RegExp(`\\b(${escapedWord}\\w*)\\b`, "gi");
  const parts = sentence.split(regex);

  return (
    <>
      {parts.map((part, index) => {
        if (index % 2 === 1) {
          return (
            <strong
              key={index}
              className="text-gold-cream font-bold underline decoration-gold-cream/40 decoration-dotted underline-offset-4"
            >
              {part}
            </strong>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

export default function App() {
  // --- STATE INITIALIZATION ---
  const [words, setWords] = useState<GREWord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("gre_bookmarks");
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to parse stored bookmarks", e);
    }
    return [];
  });

  const [mode, setMode] = useState<AppMode>(() => {
    try {
      const stored = localStorage.getItem("gre_mode") as AppMode;
      if (stored === "study" || stored === "quiz") return stored;
    } catch {}
    return "study";
  });
  const [category, setCategory] = useState<WordCategory>(() => {
    try {
      const stored = localStorage.getItem("gre_category") as WordCategory;
      if (stored) return stored;
    } catch {}
    return "all";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [currentIdx, setCurrentIdx] = useState<number>(() => {
    try {
      const storedMode = localStorage.getItem("gre_mode") || "study";
      const key = storedMode === "study" ? "gre_study_index" : "gre_quiz_index";
      const stored = localStorage.getItem(key);
      if (stored) return parseInt(stored, 10) || 0;
    } catch (e) {
      console.error("Failed to parse stored index", e);
    }
    return 0;
  });

  // Tracks interactive answers in Study Mode (persistent)
  const [studyAnswers, setStudyAnswers] = useState<Record<string, { clickedIndex?: number; clickedText?: string; revealed: boolean }>>(() => {
    try {
      const stored = localStorage.getItem("gre_study_answers");
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to parse stored study answers", e);
    }
    return {};
  });

  // Tracks persistent evaluations in Quiz Mode
  const [quizAnswers, setQuizAnswers] = useState<Record<string, { chosenText: string; isCorrect: boolean }>>(() => {
    try {
      const stored = localStorage.getItem("gre_quiz_answers");
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to parse stored quiz answers", e);
    }
    return {};
  });
  
  const [showResults, setShowResults] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("gre_show_results");
      if (stored) return stored === "true";
    } catch (e) {
      console.error("Failed to parse stored show results", e);
    }
    return false;
  });

  const [sortOrder, setSortOrder] = useState<"original" | "az" | "shuffle">(() => {
    try {
      const stored = localStorage.getItem("gre_sort_order") as "original" | "az" | "shuffle";
      if (stored === "original" || stored === "az" || stored === "shuffle") return stored;
    } catch {}
    return "original";
  });
  const [shuffledIds, setShuffledIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("gre_shuffled_ids");
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });
  const [selectedDay, setSelectedDay] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem("gre_selected_day");
      if (stored !== null && stored !== "null") return parseInt(stored, 10);
    } catch {}
    return null;
  });
  const [shuffledOptions, setShuffledOptions] = useState<Record<string, QuizOption[]>>({});

  const [toast, setToast] = useState<{ message: string; type: "success" | "info" } | null>(null);
  const [confirmAction, setConfirmAction] = useState<"study" | "quiz" | "all" | null>(null);

  const [timerEnabled, setTimerEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("gre_timer_enabled");
      return stored === "true";
    } catch {
      return false;
    }
  });

  const [timerSeconds, setTimerSeconds] = useState<number>(() => {
    try {
      const stored = localStorage.getItem("gre_timer_seconds");
      if (stored) return parseInt(stored, 10) || 60;
    } catch {}
    return 60;
  });

  // --- GOOGLE SHEETS FETCH LOGIC ---
  const fetchWords = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("https://docs.google.com/spreadsheets/d/1CRbm94UG6gPyysrm9um9FQyTWtiEdMgks2Zvvy7O-dU/export?format=csv&gid=0");
      if (!response.ok) {
        throw new Error(`HTTP Error: Failed to fetch (Status: ${response.status})`);
      }
      const csvText = await response.text();
      const rows = parseCSV(csvText);

      let startIndex = 0;
      let hasSynonymsCol = false;
      if (rows.length > 0) {
        if ((rows[0][0] || "").toLowerCase().includes("word")) {
          startIndex = 1; // Skip header row
        }
        if (rows[0].length > 1 && (rows[0][1] || "").toLowerCase().includes("synonym")) {
          hasSynonymsCol = true;
        }
      }

      const mappedWords: GREWord[] = [];
      for (let i = startIndex; i < rows.length; i++) {
        const row = rows[i];
        const minLen = hasSynonymsCol ? 19 : 18;
        if (row.length < minLen) continue; // Skip malformed rows
        
        const wordVal = (row[0] || "").trim();
        if (!wordVal) continue; // Skip empty rows

        let synonyms = "";
        let hook = "";
        let explain = "";
        let part1 = "", think1 = "", clue1 = "";
        let part2 = "", think2 = "", clue2 = "";
        let part3 = "", think3 = "", clue3 = "";
        let summary = "";
        let pA = "", pB = "", pC = "", pD = "";
        let correctLetter = "";
        let exampleSentence: string | undefined = undefined;

        if (hasSynonymsCol) {
          synonyms = (row[1] || "").trim();
          hook = (row[2] || "").trim();
          explain = (row[3] || "").trim();
          part1 = row[4]?.trim() || "";
          think1 = row[5]?.trim() || "";
          clue1 = row[6]?.trim() || "";
          part2 = row[7]?.trim() || "";
          think2 = row[8]?.trim() || "";
          clue2 = row[9]?.trim() || "";
          part3 = row[10]?.trim() || "";
          think3 = row[11]?.trim() || "";
          clue3 = row[12]?.trim() || "";
          summary = (row[13] || "").trim();
          pA = (row[14] || "").trim();
          pB = (row[15] || "").trim();
          pC = (row[16] || "").trim();
          pD = (row[17] || "").trim();
          correctLetter = (row[18] || "").trim().toUpperCase();
          exampleSentence = row[19] ? row[19].trim() : undefined;
        } else {
          synonyms = "";
          hook = (row[1] || "").trim();
          explain = (row[2] || "").trim();
          part1 = row[3]?.trim() || "";
          think1 = row[4]?.trim() || "";
          clue1 = row[5]?.trim() || "";
          part2 = row[6]?.trim() || "";
          think2 = row[7]?.trim() || "";
          clue2 = row[8]?.trim() || "";
          part3 = row[9]?.trim() || "";
          think3 = row[10]?.trim() || "";
          clue3 = row[11]?.trim() || "";
          summary = (row[12] || "").trim();
          pA = (row[13] || "").trim();
          pB = (row[14] || "").trim();
          pC = (row[15] || "").trim();
          pD = (row[16] || "").trim();
          correctLetter = (row[17] || "").trim().toUpperCase();
          exampleSentence = row[18] ? row[18].trim() : undefined;
        }

        const soundBridge = hook ? { hook, explain } : undefined;

        const roots: RootPart[] = [];
        if (part1) {
          roots.push({ part: part1, think: think1, clue: clue1 });
        }
        if (part2) {
          roots.push({ part: part2, think: think2, clue: clue2 });
        }
        if (part3) {
          roots.push({ part: part3, think: think3, clue: clue3 });
        }
        
        const options: QuizOption[] = [
          { letter: "A", text: pA },
          { letter: "B", text: pB },
          { letter: "C", text: pC },
          { letter: "D", text: pD }
        ];

        const correctIdx = ["A", "B", "C", "D"].indexOf(correctLetter);
        if (correctIdx !== -1) {
          options[correctIdx].correct = true;
        }

        mappedWords.push({
          id: `sheet-${i - startIndex + 1}`,
          word: wordVal,
          synonyms,
          soundBridge,
          roots,
          summary,
          exampleSentence,
          options,
          sheetIndex: mappedWords.length + 1
        });
      }

      if (mappedWords.length === 0) {
        throw new Error("No vocabulary words could be constructed from the spreadsheet data.");
      }

      setWords(mappedWords);
      
      let storedShuffled: string[] = [];
      try {
        const storedStr = localStorage.getItem("gre_shuffled_ids");
        if (storedStr) {
          storedShuffled = JSON.parse(storedStr);
        }
      } catch (e) {
        console.error("Failed to parse stored shuffled IDs", e);
      }

      if (storedShuffled && storedShuffled.length > 0) {
        const mappedIds = new Set(mappedWords.map((w) => w.id));
        const filteredStored = storedShuffled.filter((id) => mappedIds.has(id));
        const storedIdSet = new Set(filteredStored);
        const missingIds = mappedWords.map((w) => w.id).filter((id) => !storedIdSet.has(id));
        const finalShuffled = [...filteredStored, ...shuffleArray(missingIds)];
        setShuffledIds(finalShuffled);
      } else {
        setShuffledIds(shuffleArray(mappedWords.map((w) => w.id)));
      }

      setIsLoading(false);
    } catch (err: any) {
      console.error("Error fetching word list:", err);
      setError(err?.message || "Failed to download lexicon dictionary. Please check your internet connection.");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWords();
  }, []);

  // Self-healing migration: Convert legacy { chosenIndex } records to the robust { chosenText } format
  useEffect(() => {
    if (words.length === 0) return;

    setQuizAnswers((prev) => {
      let isChanged = false;
      const migrated = { ...prev };

      for (const id in migrated) {
        const entry = migrated[id];
        if (entry && !("chosenText" in entry) && "chosenIndex" in entry) {
          const word = words.find((w) => w.id === id);
          if (word) {
            const correctOpt = word.options.find((o) => o.correct);
            const correctText = correctOpt ? correctOpt.text : "";

            if (entry.isCorrect) {
              migrated[id] = {
                chosenText: correctText,
                isCorrect: true
              };
              isChanged = true;
            } else {
              const legacyIdx = (entry as any).chosenIndex;
              const guessedText = word.options[legacyIdx]?.text || "";
              migrated[id] = {
                chosenText: guessedText,
                isCorrect: false
              };
              isChanged = true;
            }
          }
        }
      }

      if (isChanged) {
        localStorage.setItem("gre_quiz_answers", JSON.stringify(migrated));
        return migrated;
      }
      return prev;
    });
  }, [words]);

  // Self-healing migration for studyAnswers: Convert legacy clickedIndex to clickedText for stable state
  useEffect(() => {
    if (words.length === 0) return;

    setStudyAnswers((prev) => {
      let isChanged = false;
      const migrated = { ...prev };

      for (const id in migrated) {
        const entry = migrated[id];
        if (entry && !("clickedText" in entry) && typeof entry.clickedIndex === "number") {
          const word = words.find((w) => w.id === id);
          if (word) {
            const guessedText = word.options[entry.clickedIndex]?.text || "";
            migrated[id] = {
              ...entry,
              clickedText: guessedText
            };
            isChanged = true;
          }
        }
      }

      if (isChanged) {
        localStorage.setItem("gre_study_answers", JSON.stringify(migrated));
        return migrated;
      }
      return prev;
    });
  }, [words]);

  // --- LOCAL PERSISTENCE SYNC ---
  useEffect(() => {
    localStorage.setItem("gre_bookmarks", JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem("gre_quiz_answers", JSON.stringify(quizAnswers));
  }, [quizAnswers]);

  useEffect(() => {
    localStorage.setItem("gre_study_answers", JSON.stringify(studyAnswers));
  }, [studyAnswers]);

  useEffect(() => {
    localStorage.setItem("gre_mode", mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem("gre_category", category);
  }, [category]);

  useEffect(() => {
    localStorage.setItem("gre_selected_day", selectedDay !== null ? selectedDay.toString() : "null");
  }, [selectedDay]);

  useEffect(() => {
    localStorage.setItem("gre_sort_order", sortOrder);
  }, [sortOrder]);

  useEffect(() => {
    localStorage.setItem("gre_shuffled_ids", JSON.stringify(shuffledIds));
  }, [shuffledIds]);

  const prevModeRef = useRef<AppMode>(mode);

  useEffect(() => {
    if (prevModeRef.current === mode) {
      if (mode === "study") {
        localStorage.setItem("gre_study_index", currentIdx.toString());
      } else {
        localStorage.setItem("gre_quiz_index", currentIdx.toString());
      }
    }
    prevModeRef.current = mode;
  }, [currentIdx, mode]);

  // Restore currentIdx when mode switches
  useEffect(() => {
    try {
      const key = mode === "study" ? "gre_study_index" : "gre_quiz_index";
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        const idx = parseInt(stored, 10) || 0;
        setCurrentIdx(idx);
      } else {
        setCurrentIdx(0);
      }
    } catch (e) {
      console.error("Failed to restore index on mode change", e);
    }
  }, [mode]);

  useEffect(() => {
    localStorage.setItem("gre_show_results", showResults.toString());
  }, [showResults]);

  const triggerToast = (message: string, type: "success" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- STUDY DECK FILTERING, SORTING & SEARCH ---
  const filteredWords = useMemo(() => {
    // 1. Day batch filter first based on original index
    const range = selectedDay ? getDayRange(selectedDay) : null;
    const batchFiltered = range
      ? words.filter((word) => {
          const idx = word.sheetIndex ?? 0;
          return idx >= range.start && idx <= range.end;
        })
      : words;

    // 2. Filter remaining criteria
    const basicFiltered = batchFiltered.filter((word) => {
      // Category Filtering
      if (category === "bookmarked" && !bookmarks.includes(word.id)) return false;

      // Search Substring matching
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesWord = word.word.toLowerCase().includes(query);
        const matchesPOS = word.pos?.toLowerCase().includes(query) ?? false;
        const matchesSummary = word.summary.toLowerCase().includes(query);
        const matchesRoots = word.roots.some(
          (r) =>
            r.part.toLowerCase().includes(query) ||
            r.think.toLowerCase().includes(query) ||
            r.clue.toLowerCase().includes(query)
        );
        const matchesBridge = word.soundBridge
          ? word.soundBridge.hook.toLowerCase().includes(query) ||
            word.soundBridge.explain.toLowerCase().includes(query)
          : false;
        const matchesOptions = word.options.some((opt) => opt.text.toLowerCase().includes(query));

        return matchesWord || matchesPOS || matchesSummary || matchesRoots || matchesBridge || matchesOptions;
      }
      return true;
    });

    // 3. Sort Order Sorting
    if (sortOrder === "az") {
      return [...basicFiltered].sort((a, b) => a.word.localeCompare(b.word));
    } else if (sortOrder === "shuffle") {
      const idToIndexMap = new Map<string, number>();
      shuffledIds.forEach((id, index) => {
        idToIndexMap.set(id, index);
      });
      return [...basicFiltered].sort((a, b) => {
        const indexA = idToIndexMap.has(a.id) ? idToIndexMap.get(a.id)! : 999999;
        const indexB = idToIndexMap.has(b.id) ? idToIndexMap.get(b.id)! : 999999;
        return indexA - indexB;
      });
    }

    return basicFiltered;
  }, [words, category, bookmarks, searchQuery, sortOrder, shuffledIds, selectedDay]);

  const isFirstDayMountRef = useRef(true);

  // Reset currentIdx to 0 when selectedDay changes
  useEffect(() => {
    if (isFirstDayMountRef.current) {
      isFirstDayMountRef.current = false;
      return;
    }
    setCurrentIdx(0);
  }, [selectedDay]);

  // Adjust card index safely on filter / list size modifications
  useEffect(() => {
    if (isLoading) return;
    if (filteredWords.length === 0) {
      setCurrentIdx(0);
    } else if (currentIdx >= filteredWords.length) {
      setCurrentIdx(filteredWords.length - 1);
    } else if (currentIdx < 0) {
      setCurrentIdx(0);
    }
  }, [filteredWords.length, currentIdx, isLoading]);

  // Keyboard navigation for card sliding
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.key === "ArrowLeft") {
        setCurrentIdx((p) => Math.max(0, p - 1));
      } else if (e.key === "ArrowRight") {
        setCurrentIdx((p) => Math.min(filteredWords.length - 1, p + 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredWords.length]);

  const activeWord = filteredWords[currentIdx] || null;

  // Synchronously compute and stabilize option shuffles to avoid visual layout jumps on first render/mount.
  const currentOptions = useMemo(() => {
    if (!activeWord) return [];
    if (shuffledOptions[activeWord.id]) return shuffledOptions[activeWord.id];

    const letters = ["A", "B", "C", "D"] as const;
    const shuffled = shuffleArray<QuizOption>(activeWord.options).map((opt, i) => ({
      ...opt,
      letter: letters[i],
    }));

    // Cache the shuffled representation state asynchronously to avoid concurrent React warnings
    setTimeout(() => {
      setShuffledOptions((prev) => {
        if (prev[activeWord.id]) return prev;
        return {
          ...prev,
          [activeWord.id]: shuffled,
        };
      });
    }, 0);

    return shuffled;
  }, [activeWord?.id, shuffledOptions]);

  // --- TIMER LOGIC ---
  const [timeLeft, setTimeLeft] = useState<number>(timerSeconds);
  const [timerPaused, setTimerPaused] = useState<boolean>(false);
  const wasPausedByVisibilityRef = useRef<boolean>(false);

  // Reset timer and pause state on word change or config change
  useEffect(() => {
    setTimeLeft(timerSeconds);
    setTimerPaused(false);
    wasPausedByVisibilityRef.current = false;
  }, [activeWord?.id, timerSeconds, timerEnabled, mode]);

  useEffect(() => {
    localStorage.setItem("gre_timer_enabled", timerEnabled.toString());
  }, [timerEnabled]);

  useEffect(() => {
    localStorage.setItem("gre_timer_seconds", timerSeconds.toString());
  }, [timerSeconds]);

  const handleTimeOut = () => {
    if (!activeWord) return;

    if (mode === "study") {
      triggerToast("Time's up! Advanced to next card.", "info");
      setCurrentIdx((p) => Math.min(filteredWords.length - 1, p + 1));
    } else {
      triggerToast(`Time's up! "${activeWord.word}" was skipped.`, "info");
      
      const entry = { chosenText: "", isCorrect: false };
      setQuizAnswers((prev) => ({
        ...prev,
        [activeWord.id]: entry,
      }));

      const tempAnswers = { ...quizAnswers, [activeWord.id]: entry };
      const allAnswered = filteredWords.every((w) => tempAnswers[w.id] !== undefined);

      if (allAnswered) {
        setShowResults(true);
      } else {
        setCurrentIdx((p) => Math.min(filteredWords.length - 1, p + 1));
      }
    }
  };

  // Main countdown heartbeat
  useEffect(() => {
    if (!timerEnabled || !activeWord || showResults || timerPaused) return;

    // In quiz mode, if already answered, stop countdown
    const isQuizAnswered = mode === "quiz" && quizAnswers[activeWord.id] !== undefined;
    if (isQuizAnswered) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerEnabled, activeWord?.id, showResults, mode, quizAnswers, filteredWords, timerSeconds, timerPaused]);

  // Tab visibility tracker to auto-pause when leaving and auto-resume when returning
  useEffect(() => {
    if (!timerEnabled || !activeWord || showResults) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // If the timer isn't already paused, auto-pause it and flag it was auto-paused
        if (!timerPaused) {
          setTimerPaused(true);
          wasPausedByVisibilityRef.current = true;
        }
      } else {
        // If the timer was automatically paused by visibility change, resume it
        if (wasPausedByVisibilityRef.current) {
          setTimerPaused(false);
          wasPausedByVisibilityRef.current = false;
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [timerEnabled, activeWord?.id, showResults, timerPaused]);

  // --- ACTIONS ---
  const toggleBookmark = (id: string, name: string) => {
    if (bookmarks.includes(id)) {
      setBookmarks((prev) => prev.filter((b) => b !== id));
      triggerToast(`Removed "${name}" from your bookmarks book.`, "info");
    } else {
      setBookmarks((prev) => [...prev, id]);
      triggerToast(`Saved "${name}" to your bookmarks book.`, "success");
    }
  };

  const handleRestartQuiz = () => {
    setQuizAnswers({});
    setShuffledOptions({});
    setShowResults(false);
    setCurrentIdx(0);
    localStorage.removeItem("gre_quiz_answers");
    localStorage.removeItem("gre_quiz_index");
    localStorage.removeItem("gre_show_results");
    triggerToast("Evaluation restarted. Good luck!", "success");
  };

  const handleShuffleClick = () => {
    const newShuffled = shuffleArray(words.map((w) => w.id));
    setShuffledIds(newShuffled);
    setSortOrder("shuffle");
    setShuffledOptions({});
    setCurrentIdx(0);
    triggerToast("Vocabulary order randomized!", "success");
  };

  const handleSortOrderChange = (newOrder: "original" | "az" | "shuffle") => {
    if (newOrder === "shuffle") {
      handleShuffleClick();
    } else {
      setSortOrder(newOrder);
      setCurrentIdx(0);
      triggerToast(`Sort order changed to ${newOrder === "az" ? "Alphabetical" : "Original"}`, "info");
    }
  };

  const handleSelectOptionStudy = (index: number) => {
    if (!activeWord) return;
    const clickedText = index === -1 ? "" : (currentOptions[index]?.text || "");
    setStudyAnswers((prev) => ({
      ...prev,
      [activeWord.id]: { clickedIndex: index, clickedText, revealed: true }
    }));
  };

  const handleSelectOptionQuiz = (index: number) => {
    if (!activeWord || quizAnswers[activeWord.id]) return;

    const chosenText = index === -1 ? "" : (currentOptions[index]?.text || "");
    const correctOptionText = activeWord.options.find(o => o.correct)?.text || "";
    const isCorrect = chosenText === correctOptionText;
    
    const entry = { chosenText, isCorrect };

    setQuizAnswers((prev) => ({
      ...prev,
      [activeWord.id]: entry
    }));

    // Auto advancing logic:
    // If the entire deck inside the active filter category is finished, trigger the evaluation report summary
    const tempAnswers = { ...quizAnswers, [activeWord.id]: entry };
    const allAnswered = filteredWords.every((w) => tempAnswers[w.id] !== undefined);

    const advanceDelay = timerEnabled ? 500 : 1400;
    const resultsDelay = timerEnabled ? 600 : 1500;

    if (allAnswered) {
      setTimeout(() => {
        setShowResults(true);
      }, resultsDelay);
    } else {
      // Auto-advance to next unanswered card after a short delay
      setTimeout(() => {
        setCurrentIdx((p) => Math.min(filteredWords.length - 1, p + 1));
      }, advanceDelay);
    }
  };

  const handleSelectOption = (index: number) => {
    if (mode === "study") {
      handleSelectOptionStudy(index);
    } else {
      handleSelectOptionQuiz(index);
    }
  };

  // --- RESET PROGRESS ACTIONS ---
  const executeReset = () => {
    if (!confirmAction) return;

    if (confirmAction === "study") {
      try {
        localStorage.removeItem("gre_study_answers");
        localStorage.removeItem("gre_study_index");
        setStudyAnswers({});
        if (mode === "study") {
          setCurrentIdx(0);
        }
        triggerToast("Study progress cleared", "success");
      } catch (e) {
        console.error("Failed to clear study progress", e);
      }
    } else if (confirmAction === "quiz") {
      try {
        localStorage.removeItem("gre_quiz_answers");
        localStorage.removeItem("gre_quiz_index");
        localStorage.removeItem("gre_show_results");
        setQuizAnswers({});
        setShowResults(false);
        if (mode === "quiz") {
          setCurrentIdx(0);
        }
        triggerToast("Quiz progress cleared", "success");
      } catch (e) {
        console.error("Failed to clear quiz progress", e);
      }
    } else if (confirmAction === "all") {
      try {
        localStorage.removeItem("gre_bookmarks");
        localStorage.removeItem("gre_study_answers");
        localStorage.removeItem("gre_study_index");
        localStorage.removeItem("gre_quiz_answers");
        localStorage.removeItem("gre_quiz_index");
        localStorage.removeItem("gre_show_results");
        localStorage.removeItem("gre_timer_enabled");
        localStorage.removeItem("gre_timer_seconds");
        localStorage.removeItem("gre_mode");
        localStorage.removeItem("gre_category");
        localStorage.removeItem("gre_selected_day");
        localStorage.removeItem("gre_sort_order");
        localStorage.removeItem("gre_shuffled_ids");

        setBookmarks([]);
        setStudyAnswers({});
        setQuizAnswers({});
        setShowResults(false);
        setTimerEnabled(false);
        setTimerSeconds(60);
        setCurrentIdx(0);
        setMode("study");
        setCategory("all");
        setSelectedDay(null);
        setSortOrder("original");
        setShuffledIds([]);
        triggerToast("All data cleared", "success");
      } catch (e) {
        console.error("Failed to clear all data", e);
      }
    }

    setConfirmAction(null);
  };

  // --- STATS COMPUTATION ---
  const currentCategoryCorrectCount = useMemo(() => {
    return filteredWords.reduce((sum, w) => sum + (quizAnswers[w.id]?.isCorrect ? 1 : 0), 0);
  }, [filteredWords, quizAnswers]);

  const currentCategoryAnsweredCount = useMemo(() => {
    return filteredWords.filter((w) => quizAnswers[w.id] !== undefined).length;
  }, [filteredWords, quizAnswers]);

  // Evaluation grades & summary
  const scorePercent = filteredWords.length > 0 ? Math.round((currentCategoryCorrectCount / filteredWords.length) * 100) : 0;
  const latinHonor = useMemo(() => {
    if (scorePercent === 100) return { title: "Summa Cum Laude", desc: "Outstanding scholar! Absolute mastery of root etymology and semantic bridges.", color: "text-gold-cream" };
    if (scorePercent >= 90) return { title: "Magna Cum Laude", desc: "First-rate mind. Generous grasp of word elements and linguistic connections.", color: "text-amber-300" };
    if (scorePercent >= 75) return { title: "Cum Laude", desc: "Distinguished. Notable command of classical origins and mnemonic anchors.", color: "text-yellow-100" };
    if (scorePercent >= 50) return { title: "Passable Scholar", desc: "Competent. Shows solid growth but would profit from deeper etymology drilling.", color: "text-neutral-300" };
    return { title: "Novice Neophyte", desc: "Beginner level. Classic seedlings require patience. Return to Study Library to inspect semantic formulas.", color: "text-neutral-500" };
  }, [scorePercent]);

  const bookmarkedCountLabel = bookmarks.length;



  // Render option formatting logic
  const getOptionClasses = (optIndex: number, letter: "A" | "B" | "C" | "D") => {
    if (!activeWord) return "";

    const userAnsQuiz = quizAnswers[activeWord.id];
    const userAnsStudy = studyAnswers[activeWord.id];

    // 1. QUIZ MODE STATE
    if (mode === "quiz") {
      if (userAnsQuiz) {
        let isChosen = false;
        if ("chosenText" in userAnsQuiz) {
          isChosen = userAnsQuiz.chosenText !== "" && currentOptions[optIndex]?.text === userAnsQuiz.chosenText;
        } else if ("chosenIndex" in userAnsQuiz) {
          isChosen = (userAnsQuiz as any).chosenIndex === optIndex;
        }
        
        const correctOptionText = activeWord.options.find(o => o.correct)?.text || "";
        const isCorrect = currentOptions[optIndex]?.text === correctOptionText;

        if (isCorrect) {
          return "bg-[#1a201c] border-[#344d3d] ring-1 ring-[#4a7c59] text-white";
        }
        if (isChosen && !isCorrect) {
          return "bg-[#2e1a1a] border-[#5a2c2c] ring-1 ring-[#8b3a3a] text-white";
        }
        return "opacity-40 cursor-default border-neutral-900";
      }
      return "border-[#262626] bg-[#141414] hover:bg-[#1A1A1A] hover:border-gold-cream/40 cursor-pointer";
    }

    // 2. STUDY MODE STATE
    const isRevealed = userAnsStudy?.revealed === true;
    if (isRevealed) {
      const isCorrect = currentOptions[optIndex]?.correct === true;
      if (isCorrect) {
        return "bg-gold-cream/10 border-gold-cream/60 ring-1 ring-gold-cream/10 text-white font-medium";
      }

      let clicked = false;
      if (userAnsStudy) {
        if ("clickedText" in userAnsStudy && userAnsStudy.clickedText) {
          clicked = currentOptions[optIndex]?.text === userAnsStudy.clickedText;
        } else {
          clicked = userAnsStudy.clickedIndex === optIndex;
        }
      }

      if (clicked && !isCorrect) {
        return "bg-[#2e1a1a] border-[#5a2c2c]/80 text-white";
      }

      return "border-charcoal-border/20 bg-charcoal-surface/10 opacity-45 cursor-default";
    }

    return "border-[#262626] bg-[#141414] hover:bg-charcoal-surface hover:border-gold-cream/40 cursor-pointer transition-all";
  };

  const getLetterBadgeClasses = (optIndex: number) => {
    if (!activeWord) return "";

    const userAnsQuiz = quizAnswers[activeWord.id];
    const userAnsStudy = studyAnswers[activeWord.id];

    if (mode === "quiz") {
      if (userAnsQuiz) {
        let isChosen = false;
        if ("chosenText" in userAnsQuiz) {
          isChosen = userAnsQuiz.chosenText !== "" && currentOptions[optIndex]?.text === userAnsQuiz.chosenText;
        } else if ("chosenIndex" in userAnsQuiz) {
          isChosen = (userAnsQuiz as any).chosenIndex === optIndex;
        }

        const correctOptionText = activeWord.options.find(o => o.correct)?.text || "";
        const isCorrect = currentOptions[optIndex]?.text === correctOptionText;

        if (isCorrect) return "bg-[#4a7c59] text-white border-[#4a7c59]";
        if (isChosen && !isCorrect) return "bg-[#8b3a3a] text-white border-[#8b3a3a]";
        return "bg-neutral-900 text-neutral-600 border-neutral-900";
      }
      return "bg-[#0A0A0A] text-[#A3A3A3] border-[#262626] group-hover:border-gold-cream/40 group-hover:text-gold-cream";
    }

    const isRevealed = userAnsStudy?.revealed === true;
    if (isRevealed) {
      const isCorrect = currentOptions[optIndex]?.correct === true;
      if (isCorrect) {
        return "bg-gold-cream text-charcoal-dark border-gold-cream font-bold";
      }

      let clicked = false;
      if (userAnsStudy) {
        if ("clickedText" in userAnsStudy && userAnsStudy.clickedText) {
          clicked = currentOptions[optIndex]?.text === userAnsStudy.clickedText;
        } else {
          clicked = userAnsStudy.clickedIndex === optIndex;
        }
      }

      if (clicked && !isCorrect) {
        return "bg-[#8b3a3a] text-white border-[#8b3a3a]";
      }

      return "bg-neutral-900 text-neutral-600 border-neutral-900 opacity-60";
    }

    return "bg-[#0A0A0A] text-neutral-400 border-[#262626] group-hover:border-gold-cream/40 group-hover:text-gold-cream";
  };

  // Track if current visual left-pane card is locked
  const isLeftPaneLocked = useMemo(() => {
    if (mode === "study") return false;
    if (!activeWord) return false;
    return quizAnswers[activeWord.id] === undefined;
  }, [mode, activeWord, quizAnswers]);

  if (isLoading) {
    return (
      <div id="gre-layout-root" className="min-h-screen bg-charcoal-dark font-sans flex flex-col items-center justify-center p-6 selection:bg-gold-cream/20 selection:text-gold-cream">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <RefreshCw className="w-10 h-10 text-gold-cream animate-spin" />
          </div>
          <p className="font-serif text-lg tracking-wide font-semibold text-gold-cream animate-pulse">
            Loading Lexicon...
          </p>
          <p className="text-xs text-neutral-500 max-w-xs mx-auto leading-relaxed font-sans">
            Downloading high-yield etymology, roots, and semantic maps from Google Sheets.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div id="gre-layout-root" className="min-h-screen bg-charcoal-dark font-sans flex flex-col items-center justify-center p-6 selection:bg-gold-cream/20 selection:text-gold-cream">
        <div className="bg-charcoal-surface border border-charcoal-border rounded-3xl p-8 max-w-sm text-center shadow-2xl relative space-y-5">
          <div className="w-12 h-12 rounded-full bg-red-950/30 text-red-400 flex items-center justify-center mx-auto border border-red-900/40">
            <X className="w-6 h-6 text-red-400" />
          </div>
          <div className="space-y-2">
            <h3 className="font-serif text-[#E5E5E5] text-lg font-medium">Failed to Load Lexicon</h3>
            <p className="text-xs text-neutral-400 leading-relaxed font-sans">
              {error}
            </p>
          </div>
          <button
            onClick={() => fetchWords()}
            className="w-full py-2 bg-gold-cream text-black hover:bg-amber-300 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-gold-cream/10"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="gre-layout-root" className="min-h-screen bg-charcoal-dark font-sans flex flex-col selection:bg-gold-cream/20 selection:text-gold-cream pb-16">
      
      {/* --- TOAST SYSTEM --- */}
      <AnimatePresence>
        {toast && (
          <motion.div
            id="toast-notification"
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
            className={`fixed top-18 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full border shadow-2xl backdrop-blur-md flex items-center gap-2.5 bg-[#141414]/90 ${
              toast.type === "success" ? "border-gold-cream/40 text-gold-cream" : "border-neutral-700 text-neutral-300"
            }`}
          >
            <Sparkles className="w-4 h-4 text-gold-cream animate-pulse" />
            <span className="text-xs tracking-wide font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
 
      {/* --- STICKY HEADER --- */}
      <header id="main-header" className="sticky top-0 z-40 bg-charcoal-surface/80 backdrop-blur-md border-b border-charcoal-border">
        <div className="max-w-4xl mx-auto px-4 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          
          {/* Logo & Headline */}
          <div className="flex items-center gap-2.5">
            <div id="badge-icon-box" className="w-8 h-8 rounded-lg bg-gold-cream/10 border border-gold-cream/30 flex items-center justify-center text-gold-cream">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-serif text-base tracking-wide font-semibold text-[#F5F5F5] flex items-center gap-1.5">
                Kwanu GRE Vocab
                <span className="text-[10px] font-mono tracking-wider bg-gold-cream/10 text-gold-cream px-1.5 py-0.5 rounded border border-gold-cream/20">
                  DECK v4.1
                </span>
              </h1>
              <p className="text-[11px] text-[#A3A3A3] font-sans leading-none mt-0.5">Etymology, Root Deconstruction & Semantic Bridging</p>
            </div>
          </div>
 
          {/* Core Control Group: Study/Quiz Tabs & Timed Mode Panel */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {/* Core App Mode Tabs */}
            <div className="flex items-center bg-[#0A0A0A] p-1 rounded-xl border border-charcoal-border animate-none">
              <button
                id="study-mode-tab"
                onClick={() => {
                  setMode("study");
                  setShowResults(false);
                  triggerToast("Switched to Study & Memorize view", "info");
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium tracking-wide transition-all cursor-pointer ${
                  mode === "study"
                    ? "bg-[#1A1A1A] text-gold-cream border border-gold-cream/20 shadow-md"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                Study Mode
              </button>
              <button
                id="evaluate-mode-tab"
                onClick={() => {
                  setMode("quiz");
                  triggerToast("Switched to Active Evaluation view", "info");
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium tracking-wide transition-all cursor-pointer ${
                  mode === "quiz"
                    ? "bg-[#1A1A1A] text-gold-cream border border-gold-cream/20 shadow-md"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                Quiz Mode
              </button>
            </div>

            {/* Timed Mode Toggle & Config */}
            <div className="flex items-center bg-[#0A0A0A] p-1 rounded-xl border border-charcoal-border h-9 shrink-0">
              <button
                id="timer-enable-btn"
                onClick={() => {
                  setTimerEnabled((prev) => !prev);
                  triggerToast(!timerEnabled ? "Timed Mode enabled" : "Timed Mode disabled", "info");
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium tracking-wide transition-all h-full cursor-pointer ${
                  timerEnabled
                    ? "bg-[#252320] text-gold-cream border border-gold-cream/20 shadow-md"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Timed Mode</span>
              </button>
              
              <div className="flex items-center gap-0.5 px-1 ml-1 border-l border-charcoal-border">
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = Math.max(10, timerSeconds - 5);
                    setTimerSeconds(nextVal);
                  }}
                  className="text-neutral-500 hover:text-gold-cream text-[13px] px-1 font-bold font-mono transition-colors cursor-pointer animate-none"
                  title="Decrease timer duration"
                >
                  -
                </button>
                <input
                  type="number"
                  min={10}
                  max={300}
                  value={timerSeconds}
                  onChange={(e) => {
                    const val = Math.max(10, Math.min(300, parseInt(e.target.value, 10) || 60));
                    setTimerSeconds(val);
                  }}
                  className="w-10 bg-charcoal-dark border border-charcoal-border rounded text-center text-xs text-gold-cream font-mono py-0.5 focus:outline-none focus:border-gold-cream/30"
                  style={{ MozAppearance: 'textfield' }}
                  title="Timer duration (seconds)"
                />
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = Math.min(300, timerSeconds + 5);
                    setTimerSeconds(nextVal);
                  }}
                  className="text-neutral-500 hover:text-gold-cream text-[13px] px-1 font-bold font-mono transition-colors cursor-pointer animate-none"
                  title="Increase timer duration"
                >
                  +
                </button>
                <span className="text-[10px] text-neutral-500 font-mono ml-0.5">s</span>
              </div>
            </div>
          </div>
        </div>
      </header>
 
      {/* --- FILTERS & SEARCH CONTAINER --- */}
      <section id="filter-wrapper" className="max-w-4xl mx-auto w-full px-4 mt-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between bg-charcoal-surface border border-charcoal-border p-2 rounded-2xl">
          
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            {/* Deck Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              <button
                id="filter-all"
                onClick={() => setCategory("all")}
                className={`px-3 py-1 rounded-xl text-xs font-medium tracking-wide border transition-all shrink-0 cursor-pointer ${
                  category === "all"
                    ? "bg-[#252320] text-gold-cream border-gold-cream/20 font-semibold"
                    : "bg-[#0A0A0A] text-[#A3A3A3] border-charcoal-border hover:bg-charcoal-surface-light"
                }`}
              >
                All Words
              </button>
              <button
                id="filter-bookmarked"
                onClick={() => setCategory("bookmarked")}
                className={`px-3 py-1 rounded-xl text-xs font-medium tracking-wide border transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  category === "bookmarked"
                    ? "bg-[#252320] text-gold-cream border-gold-cream/20 font-semibold"
                    : "bg-[#0A0A0A] text-[#A3A3A3] border-charcoal-border hover:bg-charcoal-surface-light"
                }`}
              >
                <Bookmark className="w-3 h-3 fill-gold-cream text-gold-cream" />
                Starred ({bookmarkedCountLabel})
              </button>
            </div>

            <div className="hidden md:block w-px h-5 bg-charcoal-border" />

            {/* Deck Sort Order (3-way toggle) */}
            <div className="flex items-center bg-[#0A0A0A] p-1 rounded-xl border border-charcoal-border/80 self-start md:self-auto shrink-0">
              <button
                onClick={() => handleSortOrderChange("original")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium tracking-wide transition-all cursor-pointer ${
                  sortOrder === "original"
                    ? "bg-[#1A1A1A] text-gold-cream border border-gold-cream/10 shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Original
              </button>
              <button
                onClick={() => handleSortOrderChange("az")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium tracking-wide transition-all cursor-pointer ${
                  sortOrder === "az"
                    ? "bg-[#1A1A1A] text-gold-cream border border-gold-cream/10 shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                A→Z
              </button>
              <button
                onClick={handleShuffleClick}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium tracking-wide transition-all flex items-center gap-1 cursor-pointer ${
                  sortOrder === "shuffle"
                    ? "bg-[#1A1A1A] text-gold-cream border border-gold-cream/10 shadow-sm font-semibold"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Shuffle
              </button>
            </div>
          </div>
 
          {/* Search Box */}
          <div className="flex items-center lg:w-72">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-3.5 w-3.5 text-neutral-500" />
              </span>
              <input
                id="search-lexicon"
                type="text"
                placeholder="Search word, root, summary..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentIdx(0);
                }}
                className="w-full pl-9 pr-4 py-1.5 bg-[#0A0A0A] border border-charcoal-border rounded-xl text-xs text-[#F5F5F5] placeholder-neutral-500 focus:outline-none focus:border-gold-cream transition-all text-ellipsis"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-500 hover:text-neutral-300 pointer-events-auto"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* --- DAY BATCH FILTER ROW --- */}
      <section id="day-batch-filter-row" className="max-w-4xl mx-auto w-full px-4 mt-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none">
          <button
            onClick={() => {
              setSelectedDay(null);
              triggerToast("Showing words from all days", "info");
            }}
            className={`px-3 py-1 rounded-xl text-xs font-medium tracking-wide border transition-all shrink-0 cursor-pointer ${
              selectedDay === null
                ? "bg-[#252320] text-gold-cream border-gold-cream/20 font-semibold"
                : "bg-[#0A0A0A] text-[#A3A3A3] border-charcoal-border hover:bg-charcoal-surface-light"
            }`}
          >
            All Days
          </button>
          {[1, 2, 3, 4, 5, 6, 7].map((d) => {
            const range = getDayRange(d);
            const totalWords = range.end - range.start + 1;
            return (
              <button
                key={d}
                onClick={() => {
                  setSelectedDay(d);
                  triggerToast(`Day ${d} batch selected (${totalWords} words)`, "info");
                }}
                className={`px-3 py-1 rounded-xl text-xs font-medium tracking-wide border transition-all shrink-0 cursor-pointer ${
                  selectedDay === d
                    ? "bg-[#252320] text-gold-cream border-gold-cream/20 font-semibold"
                    : "bg-[#0A0A0A] text-[#A3A3A3] border-charcoal-border hover:bg-charcoal-surface-light"
                }`}
              >
                Day {d}
              </button>
            );
          })}
        </div>
      </section>

      {/* --- PROGRESS BAR COMPONENT --- */}
      {filteredWords.length > 0 && !showResults && (
        <section id="progress-wrapper" className="max-w-4xl mx-auto w-full px-4 mt-3 flex flex-col gap-1.5">
          {selectedDay !== null && (
            <div className="flex items-center justify-between text-[10px] font-mono tracking-wider text-neutral-500 uppercase">
              <span className="text-gold-cream">
                Day {selectedDay} &middot; {getDayRange(selectedDay).end - getDayRange(selectedDay).start + 1} words
              </span>
            </div>
          )}
          <div className="bg-[#141414] border border-charcoal-border/30 rounded-full h-1.5 overflow-hidden relative">
            <motion.div
              id="progress-fill"
              className="bg-gold-cream h-full"
              initial={{ width: 0 }}
              animate={{ width: `${((currentIdx + 1) / filteredWords.length) * 100}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>
        </section>
      )}

      {/* --- MAIN PLAYABLE GRID --- */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 mt-3.5 relative">
        <AnimatePresence mode="wait">
          
          {/* 1. QUIZ RESULTS SCREEN */}
          {showResults && mode === "quiz" ? (
            <motion.div
              key="quiz-results"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.3 }}
              className="bg-charcoal-surface border-t-4 border-t-gold-cream border-charcoal-border p-8 rounded-3xl shadow-2xl relative overflow-hidden flex flex-col items-center text-center"
            >
              {/* Sparkles background effect */}
              <div className="absolute right-4 top-4 text-gold-cream/15 animate-ping duration-1000">
                <Sparkles className="w-16 h-16" />
              </div>

              <div className="w-16 h-16 rounded-2xl bg-gold-cream/15 flex items-center justify-center text-gold-cream mb-4">
                <Award className="w-9 h-9" />
              </div>

              <h2 className="font-serif text-3xl md:text-4xl text-[#F5F5F5] tracking-wide mb-1">
                Evaluation Completed
              </h2>
              <p className="text-sm text-[#A3A3A3] mb-8 font-sans max-w-md">
                Your classical roots translation metrics have been audited and scored below.
              </p>

              {/* Glowing circular score frame */}
              <div id="results-score-wheel" className="relative w-40 h-40 rounded-full border-4 border-gold-cream/30 flex flex-col items-center justify-center bg-black/40 mb-6 shadow-inner animate-[pulse_3s_infinite]">
                <span className="font-mono text-4xl md:text-5xl font-bold text-gold-cream">{currentCategoryCorrectCount}</span>
                <span className="text-xxs font-mono text-neutral-500 uppercase tracking-widest mt-1">out of {filteredWords.length}</span>
                <div className="absolute -top-1 -right-1 bg-gold-cream text-black text-xxs font-mono font-bold px-1.5 py-0.5 rounded-full">
                  {scorePercent}%
                </div>
              </div>

              {/* Latin Honors Honorifics */}
              <div id="honors-plate" className="mb-8">
                <p className={`font-serif text-2xl font-semibold tracking-wide ${latinHonor.color}`}>
                  {latinHonor.title}
                </p>
                <p className="text-xs text-[#a3a3a3] max-w-md mt-2 leading-relaxed">
                  {latinHonor.desc}
                </p>
              </div>

              {/* Collapsible Missed Vocabulary list */}
              {filteredWords.length - currentCategoryCorrectCount > 0 && (
                <div id="missed-words-panel" className="w-full max-w-lg bg-[#0A0A0A] border border-charcoal-border rounded-2xl p-4 mb-8 text-left">
                  <h3 className="font-serif text-[#F5F5F5] font-medium text-sm flex items-center gap-2 mb-3 border-b border-charcoal-border pb-2">
                    <BookMarked className="w-4 h-4 text-gold-cream" />
                    Inspect Missed Vocabulary ({filteredWords.length - currentCategoryCorrectCount})
                  </h3>
                  <div className="max-h-52 overflow-y-auto space-y-2.5 pr-1">
                    {filteredWords.map((word) => {
                      const ans = quizAnswers[word.id];
                      if (ans && !ans.isCorrect) {
                        return (
                          <div key={word.id} className="flex items-center justify-between text-xs p-2.5 bg-charcoal-surface rounded-xl border border-charcoal-border flex-wrap gap-2">
                            <div>
                              <strong className="text-gold-cream font-serif text-sm font-semibold">{word.word}</strong>
                              <span className="text-xxs ml-2 text-neutral-500 font-mono uppercase">{word.pos}</span>
                              <p className="text-[11px] text-[#A3A3A3] mt-0.5 flex flex-wrap items-center gap-1.5">
                                <span>Correct option: {(shuffledOptions[word.id] ?? word.options).find(o => o.correct)?.text}</span>
                                {((ans as any).chosenText === "" || ans.chosenIndex === -1) && (
                                  <span className="text-rose-400 font-mono text-[9px] uppercase tracking-wider bg-rose-500/10 border border-rose-500/20 px-1 py-0.5 rounded leading-none">
                                    Timeout
                                  </span>
                                )}
                              </p>
                            </div>
                            <button
                              onClick={() => toggleBookmark(word.id, word.word)}
                              className="text-neutral-500 hover:text-gold-cream p-1 rounded-md transition-colors"
                              title="Star word to revise later"
                            >
                              {bookmarks.includes(word.id) ? (
                                <Star className="w-3.5 h-3.5 fill-gold-cream text-gold-cream" />
                              ) : (
                                <Star className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              )}

              {/* Actions row */}
              <div className="flex flex-col sm:flex-row items-center gap-3.5">
                <button
                  id="re-evaluate-btn"
                  onClick={handleRestartQuiz}
                  className="px-6 py-2.5 bg-neutral-900 border border-gold-cream/20 text-gold-cream hover:bg-neutral-800 rounded-xl text-xs font-semibold tracking-wider flex items-center gap-2 transition-all w-full sm:w-auto justify-center cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  RE-EVALUATE DECK
                </button>
                <button
                  id="results-return-study-btn"
                  onClick={() => {
                    setMode("study");
                    setShowResults(false);
                    setCurrentIdx(0);
                  }}
                  className="px-6 py-2.5 bg-gold-cream text-charcoal-dark hover:bg-amber-300 rounded-xl text-xs font-bold tracking-wider flex items-center gap-2 transition-all w-full sm:w-auto justify-center cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  RETURN TO STUDY LIBRARY
                </button>
              </div>
            </motion.div>
          ) : !activeWord ? (
            
            // 2. EMPTY STATE
            <motion.div
              key="empty-state"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-charcoal-surface border border-charcoal-border rounded-3xl p-8 text-center shadow-lg"
            >
              <div className="w-12 h-12 rounded-full bg-gold-cream/5 text-gold-cream/60 flex items-center justify-center mx-auto mb-3 border border-gold-cream/15">
                <HelpCircle className="w-6 h-6" />
              </div>
              <p className="font-serif text-[#E5E5E5] text-lg font-medium mb-1">No Words Matching Filter</p>
              <p className="text-xs text-neutral-500 max-w-md mx-auto leading-relaxed">
                {category === "bookmarked"
                  ? "Your Starred Bookmarks deck is empty. Tap the star icon on vocabulary cards to store high-yield review cards."
                  : "We found zero matches for your search descriptor. Ensure correct spellings or clear current query terms."}
              </p>
              
              <div className="mt-4 flex justify-center gap-4">
                {(category !== "all" || searchQuery) && (
                  <button
                    onClick={() => {
                      setCategory("all");
                      setSearchQuery("");
                      setCurrentIdx(0);
                    }}
                    className="px-4 py-1.5 bg-neutral-900 border border-charcoal-border hover:bg-neutral-800 text-xs font-medium tracking-wide rounded-xl transition-all cursor-pointer"
                  >
                    Reset Active Filters
                  </button>
                )}
              </div>
            </motion.div>
          ) : (
            
            // 3. WORD CARD INTERFACE (2 Columns Layout)
            <motion.div
              key={activeWord.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.28, ease: "easeInOut" }}
              className="bg-charcoal-surface border border-charcoal-border rounded-2xl p-4 md:p-5.5 shadow-2xl relative"
            >
              {/* Card Meta Stats Row */}
              <div className="flex items-center justify-between border-b border-charcoal-border pb-2.5 mb-3.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xxs tracking-widest text-gold-cream uppercase">
                    {mode === "study" ? "STUDY & ANCHOR" : "Quiz Question"}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-gold-cream/50" />
                  <span className="font-mono text-[10px] tracking-wider text-neutral-500">
                    {currentIdx + 1} of {filteredWords.length}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Bookmark Button */}
                  <button
                    onClick={() => toggleBookmark(activeWord.id, activeWord.word)}
                    className="p-1 px-2 rounded-lg bg-neutral-900 border border-charcoal-border text-neutral-400 hover:text-gold-cream transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                    title={bookmarks.includes(activeWord.id) ? "Starred" : "Star Word"}
                  >
                    {bookmarks.includes(activeWord.id) ? (
                      <>
                        <Star className="w-3.5 h-3.5 fill-gold-cream text-gold-cream" />
                        <span className="text-gold-cream font-mono">Starred</span>
                      </>
                    ) : (
                      <>
                        <Star className="w-3.5 h-3.5" />
                        <span className="font-mono">Star</span>
                      </>
                    )}
                  </button>

                  {/* Clear Study Progress Button */}
                  {mode === "study" && Object.keys(studyAnswers).length > 0 && (
                    <button
                      onClick={() => {
                        setStudyAnswers({});
                        localStorage.removeItem("gre_study_answers");
                        triggerToast("Study progress cleared!", "success");
                      }}
                      className="p-1 px-2 rounded-lg bg-[#2e1a1a]/50 border border-[#5a2c2c]/40 text-rose-400 hover:text-rose-300 hover:bg-[#2e1a1a]/85 transition-all cursor-pointer flex items-center gap-1.5 text-[11px]"
                      title="Clear all study answers"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span className="font-mono">Reset Study</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Core Vocabulary Header Title */}
              <div className="mb-3.5 flex items-center justify-between gap-2.5 flex-wrap">
                <div className="flex items-baseline gap-2.5 flex-wrap">
                  <h2 className="font-serif text-2xl md:text-3xl text-[#F5F5F5] font-semibold tracking-wide">
                    {activeWord.word}
                    {mode === "study" && activeWord.synonyms && (
                      <span className="font-sans text-[0.85rem] text-[#F5E6C8] opacity-60 ml-[0.5rem] font-normal tracking-normal select-all">
                        {" · "}{activeWord.synonyms}
                      </span>
                    )}
                  </h2>
                  {activeWord.pos && (
                    <span className="font-mono text-[9px] uppercase font-semibold tracking-widest bg-gold-cream/10 text-gold-cream border border-gold-cream/20 px-1.5 py-0.5 rounded leading-none">
                      {activeWord.pos}
                    </span>
                  )}
                </div>

                {/* COUNTDOWN TIMER RING */}
                {timerEnabled && (
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-2 bg-black/30 border border-charcoal-border/50 px-3 py-1.5 rounded-2xl shadow-inner shrink-0 leading-none">
                      <div className="relative w-8 h-8 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90">
                          {/* Background ring */}
                          <circle
                            cx="16"
                            cy="16"
                            r="13"
                            className="stroke-charcoal-border/40 fill-none"
                            strokeWidth="2.5"
                          />
                          {/* Foreground animated ring */}
                          <motion.circle
                            cx="16"
                            cy="16"
                            r="13"
                            className="fill-none"
                            strokeWidth="2.5"
                            stroke={
                              timeLeft <= 10
                                ? "#ef4444" // red
                                : timeLeft <= 20
                                ? "#f97316" // orange
                                : "#C0B49E" // gold-cream
                            }
                            strokeDasharray={2 * Math.PI * 13}
                            initial={{ strokeDashoffset: 0 }}
                            animate={{
                              strokeDashoffset: (2 * Math.PI * 13) * (1 - timeLeft / timerSeconds),
                            }}
                            transition={{ duration: 0.35, ease: "linear" }}
                          />
                        </svg>
                        {/* Numeric centered countdown */}
                        <span
                          className={`absolute font-mono text-xs font-bold leading-none translate-y-[0.5px] ${
                            timeLeft <= 10
                              ? "text-red-500 animate-[pulse_0.5s_infinite]"
                              : timeLeft <= 20
                              ? "text-orange-500"
                              : "text-gold-cream"
                          }`}
                        >
                          {timeLeft}
                        </span>
                      </div>
                      <span className="font-mono text-[9px] tracking-wider text-neutral-500 uppercase leading-none select-none">
                        {timerPaused ? "paused" : "sec left"}
                      </span>
                    </div>

                    {/* Pause/Resume button */}
                    <button
                      id="timer-pause-resume-btn"
                      onClick={() => setTimerPaused((p) => !p)}
                      className={`h-8 px-3 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xxs font-mono font-bold uppercase tracking-wider ${
                        timerPaused
                          ? "border-emerald-500/30 bg-[#0e2c1e]/40 text-emerald-400 hover:bg-[#0e2c1e]/60 hover:border-emerald-500/50"
                          : "border-gold-cream/20 bg-black/40 text-gold-cream hover:bg-gold-cream/10"
                      }`}
                      title={timerPaused ? "Resume learning timer" : "Pause learning timer"}
                    >
                      {timerPaused ? (
                        <>
                          <Play className="w-3 h-3 text-emerald-400 fill-emerald-400/25" />
                          <span>Resume</span>
                        </>
                      ) : (
                        <>
                          <Pause className="w-3 h-3 text-gold-cream fill-gold-cream/25" />
                          <span>Pause</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Grid content space */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch mt-2">
                
                {/* A. LEFT COLUMN: SEMANTIC BRIDGING & CLASSICAL ROOTS */}
                <div className="col-span-12 md:col-span-5 flex flex-col gap-3.5 justify-between py-1 min-h-[220px]">
                  {isLeftPaneLocked ? (
                    
                    // IF QUIZ MODE AND UNANSWERED: Keep clues hidden to test pure recall
                    <div id="locked-study-pane" className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed border-charcoal-border rounded-2xl bg-black/30">
                      <div className="w-10 h-10 rounded-xl bg-charcoal-surface flex items-center justify-center border border-charcoal-border text-neutral-500 mb-3 animate-pulse">
                        <BrainCircuit className="w-5 h-5" />
                      </div>
                      <p className="font-serif text-[#E5E1D8] text-xs font-medium mb-1">Clues Locked in Quiz Mode</p>
                      <p className="text-[10px] text-neutral-500 leading-relaxed max-w-[200px]">
                        Select a multiple-choice option on the right to reveal the Sound Bridge, Classical Roots, and semantic formulation formulas.
                      </p>
                    </div>
                  ) : (
                    
                    // REVEALED CLUES & ANCHORS (Either Study mode, or Answered Quiz question)
                    <div id="unlocked-study-pane" className="space-y-3.5 flex-1 flex flex-col justify-between">
                      
                      {/* 1. Mnemonic Sound Bridge */}
                      {activeWord.soundBridge && (
                        <div id="sound-bridge-box" className="p-3 bg-black/40 border-l-2 border-gold-cream rounded-r-2xl space-y-1.5 shadow-sm">
                          <p className="font-serif text-gold-cream font-semibold text-sm tracking-wide flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-gold-cream" />
                            Sound Bridge
                          </p>
                          <p className="font-mono text-xs text-neutral-400 capitalize bg-[#1A1A1A] px-2 py-0.5 rounded border border-charcoal-border inline-block">
                            {activeWord.soundBridge.hook}
                          </p>
                          <p className="text-xs sm:text-sm text-[#A3A3A3] leading-relaxed">
                            {activeWord.soundBridge.explain}
                          </p>
                        </div>
                      )}

                      {/* 2. Classical Roots Analysis */}
                      {activeWord.roots && activeWord.roots.length > 0 && (
                        <div id="roots-box" className="space-y-1.5">
                          <p className="font-serif text-[#F5F5F5] font-semibold text-sm tracking-wide flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-gold-cream" />
                            Classical Roots Analysis
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {activeWord.roots.map((root, ringIdx) => (
                              <div key={ringIdx} className="bg-black/30 border border-charcoal-border rounded-xl p-2.5 flex flex-col justify-between shadow-inner">
                                <span className="font-serif text-gold-cream text-base font-semibold tracking-wide">
                                  {root.part}
                                </span>
                                <span className="font-sans text-xs text-neutral-400 font-mono tracking-wider mt-0.5 uppercase">
                                  think: {root.think}
                                </span>
                                <p className="text-xs sm:text-sm text-[#A3A3A3] mt-1 leading-relaxed">
                                  {root.clue}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </div>

                {/* B. RIGHT COLUMN: MULTIPLE CHOICE OPTIONS */}
                <div className="col-span-12 md:col-span-7 flex flex-col gap-2.5 justify-start">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-xxs uppercase tracking-wider text-neutral-500">
                      Meaning Definition Practice
                    </span>
                    
                    {/* Reveal Answer action in library mode */}
                    {mode === "study" && !studyAnswers[activeWord.id]?.revealed && (
                      <button
                        onClick={() => {
                          setStudyAnswers((prev) => ({
                            ...prev,
                            [activeWord.id]: { clickedIndex: -1, revealed: true }
                          }));
                        }}
                        className="text-gold-cream hover:text-amber-300 text-[10px] flex items-center gap-1 font-mono tracking-tight cursor-pointer bg-gold-cream/10 border border-gold-cream/20 px-2 py-0.5 rounded-lg transition-all"
                        title="Reveal correct answer"
                      >
                        <Sparkles className="w-3 h-3 text-gold-cream animate-pulse" />
                        Reveal Answer
                      </button>
                    )}

                    {/* Tiny reset action inside study mode options cards */}
                    {mode === "study" && studyAnswers[activeWord.id]?.revealed && (
                      <button
                        onClick={() => {
                          setStudyAnswers((prev) => {
                            const next = { ...prev };
                            delete next[activeWord.id];
                            return next;
                          });
                        }}
                        className="text-neutral-500 hover:text-gold-cream text-[10px] flex items-center gap-1 font-mono tracking-tight cursor-pointer"
                        title="Reset state to try again"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Clear Choice
                      </button>
                    )}
                  </div>

                  {currentOptions.map((opt, i) => {
                    const optionSelected = mode === "quiz" ? quizAnswers[activeWord.id] !== undefined : studyAnswers[activeWord.id]?.revealed === true;
                    return (
                      <button
                        key={i}
                        disabled={optionSelected}
                        onClick={() => handleSelectOption(i)}
                        className={`flex items-start md:items-center gap-3 p-2.5 rounded-xl text-left transition-all duration-200 group w-full ${getOptionClasses(
                          i,
                          opt.letter
                        )}`}
                      >
                        {/* Option prefix letters A, B, C, D */}
                        <span className={`flex-shrink-0 w-7 h-7 rounded-lg text-xs font-mono font-bold flex items-center justify-center border transition-all ${getLetterBadgeClasses(
                          i
                        )}`}>
                          {opt.letter}
                        </span>

                        {/* Option description meaning text */}
                        <span className="text-xs text-[#E5E5E5] leading-normal font-sans group-hover:text-white transition-colors pt-0.5 md:pt-0">
                          {opt.text}
                        </span>

                        {/* Status Check/Cross markers */}
                        {mode === "quiz" && quizAnswers[activeWord.id] && (
                          <div className="ml-auto self-center shrink-0">
                            {opt.text === (activeWord.options.find(o => o.correct)?.text || "") ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : ("chosenText" in quizAnswers[activeWord.id] && quizAnswers[activeWord.id].chosenText === opt.text) || ("chosenIndex" in quizAnswers[activeWord.id] && (quizAnswers[activeWord.id] as any).chosenIndex === i) ? (
                              <X className="w-4 h-4 text-rose-400" />
                            ) : null}
                          </div>
                        )}

                        {mode === "study" && studyAnswers[activeWord.id]?.revealed && (
                          <div className="ml-auto self-center shrink-0">
                            {opt.correct ? (
                              <Check className="w-4 h-4 text-gold-cream" />
                            ) : (
                              studyAnswers[activeWord.id]?.clickedText 
                                ? studyAnswers[activeWord.id]?.clickedText === opt.text
                                : studyAnswers[activeWord.id]?.clickedIndex === i
                            ) ? (
                              <X className="w-4 h-4 text-rose-500" />
                            ) : null}
                          </div>
                        )}
                      </button>
                    );
                  })}

                  {/* GRE Context (Example Sentence) */}
                  {!isLeftPaneLocked && activeWord.exampleSentence && (
                    <div id="example-sentence-box" className="p-3 bg-black/40 border-l-2 border-gold-cream rounded-r-2xl space-y-1.5 shadow-sm mt-2">
                      <p className="font-serif text-[#F5F5F5] font-semibold text-sm tracking-wide flex items-center gap-1.5">
                        <Quote className="w-3.5 h-3.5 text-gold-cream rotate-180" />
                        GRE Context
                      </p>
                      <p className="text-xs sm:text-sm text-[#E5E5E5] italic leading-relaxed font-sans">
                        {formatExampleSentence(activeWord.exampleSentence, activeWord.word)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Lexicon Formula Full-Width Span Box */}
              {!isLeftPaneLocked && (
                <div id="summary-box" className="mt-4 p-4 bg-[#141414]/60 border border-charcoal-border rounded-2xl text-[13px] sm:text-sm">
                  <span className="font-mono text-[10px] sm:text-xs uppercase tracking-widest text-[#a3a3a3] block mb-1 text-left">
                    Lexicon Formula
                  </span>
                  <p
                    className="text-[#E5E5E5] italic leading-relaxed font-sans text-left"
                    dangerouslySetInnerHTML={{ __html: activeWord.summary }}
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* --- SETTINGS / DATA MANAGEMENT SECTION --- */}
      <section id="settings-management-wrapper" className="max-w-4xl mx-auto w-full px-4 mt-8 mb-24">
        <div className="bg-[#101010]/70 border border-charcoal-border/50 rounded-2xl p-5 sm:p-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 border-b border-charcoal-border pb-4 mb-4">
            <div>
              <h3 className="font-serif text-[#F5F5F5] text-sm sm:text-base font-semibold tracking-wide flex items-center gap-2">
                <Database className="w-4.5 h-4.5 text-gold-cream" />
                Data & Progress Management
              </h3>
              <p className="text-xs text-neutral-500 mt-1 font-sans leading-relaxed">
                Reset your vocabulary learning progress, evaluation scores, or clean your local cached settings and bookmarks.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3">
            <button
              id="clear-study-progress-btn"
              onClick={() => setConfirmAction("study")}
              className="w-full sm:w-auto px-4 py-2 text-xs font-mono font-medium tracking-wide rounded-xl border border-red-500/20 bg-red-950/10 text-red-400 hover:bg-red-950/30 hover:border-red-500/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear Study Progress
            </button>
            <button
              id="clear-quiz-progress-btn"
              onClick={() => setConfirmAction("quiz")}
              className="w-full sm:w-auto px-4 py-2 text-xs font-mono font-medium tracking-wide rounded-xl border border-red-500/20 bg-red-950/10 text-red-400 hover:bg-red-950/30 hover:border-red-500/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear Quiz Progress
            </button>
            <button
              id="clear-everything-btn"
              onClick={() => setConfirmAction("all")}
              className="w-full sm:w-auto px-4 py-2 text-xs font-mono font-bold tracking-wide rounded-xl bg-red-800/90 text-white hover:bg-red-900 shadow-md shadow-red-800/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 focus:outline-none ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Everything
            </button>
          </div>
        </div>
      </section>

      {/* --- CONFIRMATION DIALOG MODAL --- */}
      <AnimatePresence>
        {confirmAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="w-full max-w-sm bg-[#141414] border border-[#3E2424]/40 rounded-2xl p-6 shadow-2xl relative"
            >
              <div className="flex items-center gap-3 text-rose-500 mb-3">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h4 className="font-serif text-base font-semibold text-white">
                  Confirm Reset
                </h4>
              </div>
              
              <div className="space-y-4 mb-6">
                <p className="text-xs text-neutral-400 leading-relaxed font-sans">
                  {confirmAction === "study" && "You are about to clear your Study & Memorize answers and index."}
                  {confirmAction === "quiz" && "You are about to clear your Active Evaluation metrics and scores."}
                  {confirmAction === "all" && "You are about to delete all bookmarks, study/quiz states, and personalized configurations."}
                </p>
                <p className="text-xs font-semibold text-rose-400 font-mono">
                  Are you sure? This action cannot be undone.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 font-mono text-[11px]">
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  className="px-3 py-1.5 rounded-lg bg-[#1A1A1A] border border-charcoal-border hover:bg-[#222222] text-neutral-400 hover:text-white transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeReset}
                  className={`px-3 py-1.5 rounded-lg text-white font-bold transition-all cursor-pointer ${
                    confirmAction === "all"
                      ? "bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/10"
                      : "bg-red-500 hover:bg-red-600 shadow-md shadow-red-500/10"
                  }`}
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- BOTTOM NAVIGATION FLOATING CONTROLS --- */}
      {!showResults && (
        <nav id="bottom-navbar" className="fixed bottom-0 left-0 right-0 z-30 bg-[#141414]/90 backdrop-blur-md border-t border-charcoal-border py-2.5">
          <div className="max-w-4xl mx-auto px-4 flex items-center justify-between gap-4">
            
            {/* Prev button */}
            <button
              id="nav-btn-prev"
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx((p) => Math.max(0, p - 1))}
              className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-3.5 py-1.5 rounded-xl border transition-all ${
                currentIdx === 0
                  ? "opacity-30 border-charcoal-border text-neutral-600 cursor-not-allowed"
                  : "border-charcoal-border hover:bg-[#1A1A1A] text-[#E5E1D8] hover:text-white cursor-pointer"
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Prev
            </button>

            {/* Middle counter information */}
            <div className="flex flex-col items-center">
              {mode === "study" ? (
                <>
                  <span className="font-mono text-[9px] font-bold text-neutral-400 uppercase tracking-widest leading-none">
                    Study Library
                  </span>
                  <span className="font-serif text-xs font-semibold mt-0.5 text-[#e5e1d8]">
                    Word {filteredWords.length > 0 ? currentIdx + 1 : 0} of {filteredWords.length}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-mono text-[9px] font-bold text-gold-cream uppercase tracking-widest leading-none">
                    EVALUATION METRICS
                  </span>
                  <span className="font-serif text-xs font-semibold mt-0.5 text-white">
                    Score: {currentCategoryCorrectCount} / {currentCategoryAnsweredCount} answered
                  </span>
                </>
              )}
            </div>

            {/* Next or Finish / Submit Buttons */}
            {mode === "quiz" && filteredWords.length > 0 && currentCategoryAnsweredCount === filteredWords.length ? (
              <button
                id="view-results-btn"
                onClick={() => setShowResults(true)}
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-4 py-1.5 bg-gold-cream text-black hover:bg-amber-300 rounded-xl transition-all shadow-lg shadow-gold-cream/10 cursor-pointer"
              >
                View Results
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                id="nav-btn-next"
                disabled={filteredWords.length === 0 || currentIdx === filteredWords.length - 1}
                onClick={() => setCurrentIdx((p) => Math.min(filteredWords.length - 1, p + 1))}
                className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-4 py-1.5 rounded-xl border transition-all ${
                  filteredWords.length === 0 || currentIdx === filteredWords.length - 1
                    ? "opacity-30 border-charcoal-border text-neutral-600 cursor-not-allowed"
                    : "bg-gold-cream/10 hover:bg-gold-cream/20 border-gold-cream/20 text-gold-cream cursor-pointer"
                }`}
              >
                Next
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </nav>
      )}

    </div>
  );
}
