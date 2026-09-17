import { useState, useEffect, useCallback, useRef } from 'react';

// --- ДАННЫЕ УРОВНЕЙ ---
interface GameLevel {
  letters: string;
  words: string[];
}

const gameLevels: GameLevel[] = [
  { letters: "КОРЬТО", words: ["КОТ", "РОТ", "ТОК", "РОК", "КРОТ", "ТОРТ", "КОРТ", "РОТОР"] },
  { letters: "ЗИМА", words: ["ЗИМ", "МИР", "РИМ", "ЗИМА"] },
  { letters: "РУКАВ", words: ["РУК", "ВАР", "РАВ", "УРА", "РУКАВ"] },
  { letters: "СЛОН", words: ["СОН", "ЛОС", "НОС", "СЛОН"] },
  { letters: "АРБУЗ", words: ["АРБ", "БУЗ", "ЗУБ", "БРА", "АРБУЗ"] },
];

interface Tile {
  letter: string;
  used: boolean;
  id: number;
}

function validateDictionary(availableLetters: string, words: string[]): string[] {
  const letterCounts: Record<string, number> = {};
  for (const char of availableLetters) {
    letterCounts[char] = (letterCounts[char] || 0) + 1;
  }

  return words.filter(word => {
    const wordCounts: Record<string, number> = {};
    for (const char of word) {
      wordCounts[char] = (wordCounts[char] || 0) + 1;
    }
    for (const char in wordCounts) {
      if (!letterCounts[char] || wordCounts[char] > letterCounts[char]) {
        return false;
      }
    }
    return true;
  });
}

export default function App() {
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hintPenaltyPending, setHintPenaltyPending] = useState(0);
  const [currentTiles, setCurrentTiles] = useState<Tile[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [showWinModal, setShowWinModal] = useState(false);
  const [hintTileId, setHintTileId] = useState<number | null>(null);
  const [successFlash, setSuccessFlash] = useState(false);
  
  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get validated words for current level
  const currentLevel = gameLevels[currentLevelIndex];
  const validWords = validateDictionary(currentLevel.letters, currentLevel.words);
  const totalWords = validWords.length;
  const foundCount = foundWords.length;
  const progressPercent = totalWords > 0 ? (foundCount / totalWords) * 100 : 0;

  // Initialize level
  const loadLevel = useCallback((index: number) => {
    if (index >= gameLevels.length) {
      setCurrentLevelIndex(0);
      setScore(0);
      setFoundWords([]);
      setSelectedIndices([]);
      setStreak(0);
      setHintPenaltyPending(0);
      setMessage('');
      setShowWinModal(false);
      
      const levelData = gameLevels[0];
      const validated = validateDictionary(levelData.letters, levelData.words);
      const tiles: Tile[] = levelData.letters.split('').map((letter, i) => ({
        letter,
        used: false,
        id: i
      }));
      setCurrentTiles(tiles);
      return;
    }

    const levelData = gameLevels[index];
    const validated = validateDictionary(levelData.letters, levelData.words);
    
    const tiles: Tile[] = levelData.letters.split('').map((letter, i) => ({
      letter,
      used: false,
      id: i
    }));

    setFoundWords([]);
    setSelectedIndices([]);
    setStreak(0);
    setHintPenaltyPending(0);
    setMessage('');
    setCurrentTiles(tiles);
    setShowWinModal(false);
    setHintTileId(null);
  }, []);

  // Initial load
  useEffect(() => {
    loadLevel(0);
  }, [loadLevel]);

  // Handle tile click
  const handleTileClick = useCallback((index: number) => {
    setCurrentTiles(prev => {
      if (prev[index].used) return prev;
      const newTiles = [...prev];
      newTiles[index] = { ...newTiles[index], used: true };
      return newTiles;
    });
    setSelectedIndices(prev => [...prev, index]);
    setMessage('');
    setHintTileId(null);
  }, []);

  // Clear word
  const clearWord = useCallback(() => {
    setCurrentTiles(prev => prev.map(t => ({ ...t, used: false })));
    setSelectedIndices([]);
    setMessage('');
  }, []);

  // Show message with shake
  const showMessage = useCallback((text: string, shake: boolean = false) => {
    setMessage(text);
    if (shake) {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
    if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
    messageTimeoutRef.current = setTimeout(() => setMessage(''), 3000);
  }, []);

  // Check word
  const checkWord = useCallback(() => {
    const word = selectedIndices.map(i => currentTiles[i].letter).join('');
    
    if (word.length < 3) {
      showMessage("Слово слишком короткое!", true);
      return;
    }

    if (foundWords.includes(word)) {
      showMessage("Это слово уже найдено!", true);
      return;
    }

    if (validWords.includes(word)) {
      // Correct word
      const newFoundWords = [...foundWords, word];
      setFoundWords(newFoundWords);
      
      const newStreak = streak + 1;
      setStreak(newStreak);
      
      // Calculate points
      let points = 10 + (word.length * 2);
      if (newStreak > 1) points += newStreak * 2;
      
      // Apply hint penalty
      let newPenalty = hintPenaltyPending;
      if (newPenalty > 0) {
        const deduction = Math.min(newPenalty, points);
        points -= deduction;
        newPenalty -= deduction;
        if (points < 0) points = 0;
      }
      setHintPenaltyPending(newPenalty);
      setScore(prev => prev + points);
      
      showMessage(`+${points} очков!`, false);
      setSuccessFlash(true);
      setTimeout(() => setSuccessFlash(false), 500);

      // Check win
      if (newFoundWords.length === validWords.length) {
        setTimeout(() => setShowWinModal(true), 800);
      } else {
        setTimeout(() => {
          setCurrentTiles(prev => prev.map(t => ({ ...t, used: false })));
          setSelectedIndices([]);
        }, 600);
      }
    } else {
      setStreak(0);
      showMessage("Такого слова нет в списке!", true);
      setTimeout(() => {
        setCurrentTiles(prev => prev.map(t => ({ ...t, used: false })));
        setSelectedIndices([]);
      }, 600);
    }
  }, [selectedIndices, currentTiles, foundWords, validWords, streak, hintPenaltyPending, showMessage]);

  // Use hint
  const useHint = useCallback(() => {
    const remainingWords = validWords.filter(w => !foundWords.includes(w));
    if (remainingWords.length === 0) return;

    const targetWord = remainingWords[Math.floor(Math.random() * remainingWords.length)];
    
    const neededLetters: Record<string, number> = {};
    for (const char of targetWord) {
      neededLetters[char] = (neededLetters[char] || 0) + 1;
    }

    const availableTileIndices: number[] = [];
    currentTiles.forEach((tile, idx) => {
      if (!tile.used && neededLetters[tile.letter] > 0) {
        availableTileIndices.push(idx);
        neededLetters[tile.letter]--;
      }
    });

    if (availableTileIndices.length > 0) {
      const randomIdx = availableTileIndices[Math.floor(Math.random() * availableTileIndices.length)];
      setHintTileId(currentTiles[randomIdx].id);
      
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
      hintTimeoutRef.current = setTimeout(() => setHintTileId(null), 2000);
      
      setHintPenaltyPending(prev => prev + 15);
      showMessage("Подсказка использована (-15 к след. слову)", false);
    } else {
      showMessage(`Есть ещё слово из ${targetWord.length} букв`, false);
      setHintPenaltyPending(prev => prev + 15);
    }
  }, [validWords, foundWords, currentTiles, showMessage]);

  // Next level
  const nextLevel = useCallback(() => {
    const next = currentLevelIndex + 1;
    setCurrentLevelIndex(next);
    loadLevel(next);
  }, [currentLevelIndex, loadLevel]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showWinModal) {
        if (e.key === 'Enter') nextLevel();
        return;
      }

      const key = e.key.toUpperCase();
      
      if (key === 'ENTER') {
        checkWord();
      } else if (key === 'BACKSPACE') {
        setSelectedIndices(prev => {
          if (prev.length === 0) return prev;
          const newIndices = [...prev];
          const lastIdx = newIndices.pop()!;
          setCurrentTiles(tiles => tiles.map((t, i) => i === lastIdx ? { ...t, used: false } : t));
          return newIndices;
        });
      } else if (key === 'ESCAPE') {
        clearWord();
      } else if (/^[А-ЯЁ]$/.test(key)) {
        setCurrentTiles(tiles => {
          const tileIndex = tiles.findIndex(t => !t.used && t.letter === key);
          if (tileIndex !== -1) {
            setSelectedIndices(prev => [...prev, tileIndex]);
            const newTiles = [...tiles];
            newTiles[tileIndex] = { ...newTiles[tileIndex], used: true };
            return newTiles;
          }
          return tiles;
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showWinModal, checkWord, clearWord, nextLevel]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="text-center py-5 relative">
        <div className="scene">
          <div className="cube">
            <div className="cube__face cube__face--front">С</div>
            <div className="cube__face cube__face--back">Л</div>
            <div className="cube__face cube__face--right">О</div>
            <div className="cube__face cube__face--left">В</div>
            <div className="cube__face cube__face--top">О</div>
            <div className="cube__face cube__face--bottom">!</div>
          </div>
        </div>
        <h1 className="text-4xl font-black text-orange-600 float-title" style={{ textShadow: '2px 2px 0px rgba(255,255,255,0.5)' }}>
          Угадай слово
        </h1>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-5 flex flex-col items-center">
        {/* Game Info */}
        <div className="flex justify-between w-full bg-white py-4 px-6 rounded-2xl mb-5 font-bold text-lg" style={{ boxShadow: 'var(--shadow-soft)' }}>
          <div className="text-purple-600">Уровень: <span className="text-2xl">{currentLevelIndex + 1}</span></div>
          <div className="text-orange-600">Очки: <span className="text-2xl">{score}</span></div>
        </div>

        {/* Message Area */}
        <div className="h-8 mb-2 font-bold text-center text-red-400">
          {message}
        </div>

        {/* Word Display */}
        <div className={`flex gap-2.5 min-h-[60px] mb-8 flex-wrap justify-center ${isShaking ? 'shake' : ''}`}>
          {selectedIndices.map((idx, i) => (
            <div
              key={`${idx}-${i}`}
              className={`letter-slot ${successFlash ? 'success-flash' : ''}`}
            >
              {currentTiles[idx]?.letter}
            </div>
          ))}
        </div>

        {/* Tiles */}
        <div className="flex flex-wrap justify-center gap-4 mb-8 max-w-xl">
          {currentTiles.map((tile, index) => (
            <div
              key={tile.id}
              className={`tile ${tile.used ? 'used' : ''} ${hintTileId === tile.id ? 'hint-pulse' : ''}`}
              onClick={() => handleTileClick(index)}
            >
              {tile.letter}
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex gap-4 mb-8">
          <button
            className="px-6 py-3 border-none rounded-full font-bold text-base cursor-pointer text-white transition-transform active:scale-95"
            style={{ background: 'linear-gradient(45deg, #ffa726, #fb8c00)', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}
            onClick={clearWord}
          >
            Очистить
          </button>
          <div className="btn-hint-wrapper">
            <button
              className="px-6 py-3 border-none rounded-full font-bold text-base cursor-pointer text-white transition-transform active:scale-95"
              style={{ background: 'linear-gradient(45deg, #ab47bc, #8e24aa)', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}
              onClick={useHint}
            >
              💡 Подсказка
            </button>
            <span className="btn-hint-badge">-15</span>
          </div>
          <button
            className="px-6 py-3 border-none rounded-full font-bold text-base cursor-pointer text-white transition-transform active:scale-95"
            style={{ background: 'linear-gradient(45deg, #66bb6a, #43a047)', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}
            onClick={checkWord}
          >
            Проверить
          </button>
        </div>

        {/* Progress */}
        <div className="w-full bg-white/50 rounded-2xl h-5 mb-5 overflow-hidden" style={{ boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.05)' }}>
          <div
            className="h-full rounded-2xl transition-all duration-500"
            style={{
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, #ffcc80, #ffab91)'
            }}
          />
        </div>
        <div className="w-full text-center font-bold text-amber-800 mb-5">
          Найдено: <span>{foundCount}</span> / <span>{totalWords}</span>
        </div>

        {/* Words List */}
        <div className="grid gap-2.5 w-full mt-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))' }}>
          {validWords.map((word, i) => (
            <div
              key={`${word}-${i}`}
              className={`bg-white py-2 px-3 rounded-xl text-center font-bold text-sm transition-all duration-300 ${
                foundWords.includes(word)
                  ? 'text-green-800 bg-green-50 scale-105'
                  : 'text-gray-300'
              }`}
              style={{ boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}
            >
              {foundWords.includes(word) ? word : '•'.repeat(word.length)}
            </div>
          ))}
        </div>

        {/* Info Section */}
        <div className="mt-12 bg-white/60 p-8 rounded-2xl w-full box-border">
          <h3 className="text-purple-600 text-xl font-bold mb-4">Как играть?</h3>
          <div className="grid gap-5 mt-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
            <div className="bg-white p-4 rounded-2xl" style={{ boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
              <strong>🧩 Собирай слова</strong>
              <p className="mt-2 text-sm">Кликай по буквам или используй клавиатуру, чтобы составить слово.</p>
            </div>
            <div className="bg-white p-4 rounded-2xl" style={{ boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
              <strong>✅ Проверяй</strong>
              <p className="mt-2 text-sm">Нажми "Проверить" или Enter. Короткие слова (менее 3 букв) не считаются.</p>
            </div>
            <div className="bg-white p-4 rounded-2xl" style={{ boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
              <strong>💰 Очки и штрафы</strong>
              <p className="mt-2 text-sm">Длинные слова дают больше очков. Подсказка стоит 15 очков штрафа!</p>
            </div>
          </div>
        </div>
      </main>

      {/* Win Modal */}
      {showWinModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="text-orange-600 text-2xl font-black mb-4">Уровень пройден! 🎉</h2>
            <p className="text-xl mb-4">Ты нашел все слова!</p>
            <p className="text-xl mb-6">Текущий счет: <strong>{score}</strong></p>
            <button
              className="px-10 py-4 border-none rounded-full font-bold text-white text-xl cursor-pointer transition-transform active:scale-95"
              style={{ background: 'linear-gradient(45deg, #42a5f5, #1e88e5)', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}
              onClick={nextLevel}
            >
              Следующий уровень
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
