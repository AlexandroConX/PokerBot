import React, { useState, useEffect } from 'react';
import { Heart, Diamond, Club, Spade, Trophy, User, Bot, RefreshCw } from 'lucide-react';

// --- 1. CONFIGURACIÓN Y ESTRATEGIA ---
const STRATEGY = {
  agresividad: 0.85,
  bluff: 0.30
};

const SUITS = ['♥', '♦', '♣', '♠'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANKING = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

// --- 2. UTILIDADES ---
const createDeck = () => {
  let deck = [];
  SUITS.forEach(s => VALUES.forEach(v => deck.push({ value: v, suit: s, rank: RANKING[v] })));
  return deck.sort(() => Math.random() - 0.5);
};

const evaluateHand = (cards) => {
  if (!cards.length) return { score: 0, name: "" };
  const ranks = cards.map(c => c.rank).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  
  const counts = {};
  ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
  const maxCount = Math.max(...Object.values(counts));
  
  const isFlush = Object.values(suits.reduce((a, c) => ({...a, [c]: (a[c]||0)+1}), {})).some(c => c >= 5);
  
  let isStraight = false;
  const uniqueRanks = [...new Set(ranks)];
  for(let i=0; i<=uniqueRanks.length-5; i++) {
    if(uniqueRanks[i] - uniqueRanks[i+4] === 4) isStraight = true;
  }

  if (isFlush && isStraight) return { score: 8, name: "Escalera de Color" };
  if (maxCount === 4) return { score: 7, name: "Póker" };
  if (maxCount === 3 && Object.values(counts).includes(2)) return { score: 6, name: "Full House" };
  if (isFlush) return { score: 5, name: "Color" };
  if (isStraight) return { score: 4, name: "Escalera" };
  if (maxCount === 3) return { score: 3, name: "Trío" };
  const pairs = Object.values(counts).filter(c => c === 2).length;
  if (pairs >= 2) return { score: 2, name: "Doble Par" };
  if (pairs === 1) return { score: 1, name: "Par" };
  return { score: 0, name: "Carta Alta", high: ranks[0] };
};

// --- 3. COMPONENTE DE CARTA ---
const Card = ({ card, hidden }) => {
  if (hidden) return (
    <div className="w-12 h-16 sm:w-14 sm:h-20 bg-blue-900 border-2 border-white rounded-lg shadow-md flex items-center justify-center">
      <div className="w-8 h-12 border border-blue-400/50 rounded bg-stripes opacity-30"></div>
    </div>
  );
  
  const isRed = ['♥', '♦'].includes(card.suit);
  
  return (
    <div className={`w-12 h-16 sm:w-14 sm:h-20 bg-white border-2 rounded-lg shadow-md flex flex-col items-center justify-between p-1 ${isRed ? 'border-red-300 text-red-600' : 'border-slate-300 text-slate-900'}`}>
      <span className="text-xs sm:text-sm font-bold self-start leading-none">{card.value}</span>
      <span className="text-base sm:text-lg">
        {card.suit === '♥' && <Heart size={16} fill="currentColor"/>}
        {card.suit === '♦' && <Diamond size={16} fill="currentColor"/>}
        {card.suit === '♣' && <Club size={16} fill="currentColor"/>}
        {card.suit === '♠' && <Spade size={16} fill="currentColor"/>}
      </span>
      <span className="text-xs sm:text-sm font-bold self-end leading-none rotate-180">{card.value}</span>
    </div>
  );
};

// --- 4. COMPONENTE PRINCIPAL ---
export default function App() {
  const [game, setGame] = useState({
    deck: [], community: [], pHand: [], bHand: [],
    pot: 0, chips: { p: 1000, b: 1000 },
    phase: 'start', turn: 'player', msg: 'Bienvenido', winner: null
  });

  const deal = () => {
    if(game.chips.p <= 0 || game.chips.b <= 0) {
      return setGame(prev => ({...prev, phase: 'over', winner: null, msg: game.chips.p<=0 ? '¡Te quedaste sin fichas!' : '¡Has ganado el torneo!'}));
    }
    const d = createDeck();
    setGame({
      ...game, deck: d, community: [],
      pHand: [d.pop(), d.pop()], bHand: [d.pop(), d.pop()],
      pot: 20, chips: { p: game.chips.p - 10, b: game.chips.b - 10 },
      phase: 'pre-flop', turn: 'player', msg: 'Tu turno', winner: null
    });
  };

  // Lógica del Bot
  useEffect(() => {
    if (game.turn === 'bot' && !['end', 'showdown', 'start', 'over'].includes(game.phase) && !game.winner) {
      const timeout = setTimeout(() => {
        const isStrong = game.bHand[0].rank >= 10 || game.bHand[0].rank === game.bHand[1].rank;
        const wantRaise = (isStrong && Math.random() < STRATEGY.agresividad) || (Math.random() < STRATEGY.bluff);
        
        // Bot simple: solo resube en pre-flop si se siente fuerte, si no, pasa/iguala
        if (game.phase === 'pre-flop' && wantRaise && game.chips.b >= 100) {
            setGame(prev => ({
                ...prev, pot: prev.pot + 100, chips: {...prev.chips, b: prev.chips.b - 100},
                msg: 'Bot sube 100', turn: 'player' 
            }));
        } else {
            setGame(prev => ({ ...prev, msg: 'Bot pasa/iguala', turn: 'player' }));
            nextPhase();
        }
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [game.turn, game.phase, game.winner]);

  const nextPhase = () => {
    const { deck, community, phase } = game;
    let next = phase, newComm = community;
    if(phase==='pre-flop') { next='flop'; newComm=[deck.pop(), deck.pop(), deck.pop()]; }
    else if(phase==='flop') { next='turn'; newComm=[...community, deck.pop()]; }
    else if(phase==='turn') { next='river'; newComm=[...community, deck.pop()]; }
    else if(phase==='river') { checkWinner(); return; }
    
    setGame(prev => ({...prev, deck, community: newComm, phase: next, turn: 'player'}));
  };

  const checkWinner = (foldWinner) => {
    // Si alguien se retira
    if (foldWinner) {
        const w = foldWinner === 'p' ? 'Jugador' : 'Bot';
        setGame(prev => ({
            ...prev, phase: 'end', winner: w, 
            msg: `${w} gana por retiro`, 
            chips: {...prev.chips, [foldWinner]: prev.chips[foldWinner] + prev.pot}
        }));
        return;
    }

    // Showdown
    const pScore = evaluateHand([...game.pHand, ...game.community]);
    const bScore = evaluateHand([...game.bHand, ...game.community]);
    
    let w = 'Empate';
    if (pScore.score > bScore.score || (pScore.score === bScore.score && pScore.high > bScore.high)) w = 'p';
    else if (bScore.score > pScore.score || (bScore.score === pScore.score && bScore.high > pScore.high)) w = 'b';
    
    const winnerName = w === 'p' ? 'Jugador' : (w==='b'?'Bot':'Empate');
    const winMsg = w === 'p' ? `Ganas con ${pScore.name}` : (w === 'b' ? `Bot gana con ${bScore.name}` : 'Empate total');

    setGame(prev => ({
        ...prev, phase: 'end', winner: winnerName,
        msg: winMsg,
        chips: w === 'Empate' ? { p: prev.chips.p + prev.pot/2, b: prev.chips.b + prev.pot/2 } : { ...prev.chips, [w]: prev.chips[w] + prev.pot }
    }));
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-3xl bg-green-800 rounded-3xl border-4 sm:border-8 border-yellow-900 shadow-2xl relative overflow-hidden min-h-[600px]">
        
        {/* --- ZONA BOT (Arriba - Ajustado top-2 y gap reducido) --- */}
        <div className="absolute top-2 w-full flex flex-col items-center z-10">
           <div className={`p-1.5 rounded-full bg-slate-800 border-4 ${game.turn==='bot' ? 'border-yellow-400' : 'border-slate-600'}`}><Bot size={24}/></div>
           <span className="bg-black/40 px-2 rounded-full text-[10px] sm:text-xs mt-1 mb-1 text-yellow-100">Bot: ${game.chips.b}</span>
           <div className="flex gap-2">
             {/* Cartas del bot */}
             {game.bHand.map((c,i) => <Card key={i} card={c} hidden={game.phase !== 'end' && !game.winner} />)}
           </div>
        </div>

        {/* --- MESA (Centro - Ajustado a top-[50%] para evitar choque) --- */}
        <div className="absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center w-full">
           <div className="text-yellow-200 text-[10px] sm:text-xs uppercase font-bold tracking-widest mb-1">{game.phase}</div>
           <div className="text-3xl sm:text-4xl font-bold mb-3 drop-shadow-md bg-black/20 px-4 rounded-lg">BOTE: ${game.pot}</div>
           
           <div className="flex gap-1 sm:gap-2 p-2 sm:p-3 bg-green-900/50 rounded-xl border border-green-700 min-h-[90px] min-w-[260px] sm:min-w-[280px] justify-center items-center">
              {game.community.length === 0 ? <span className="opacity-50 font-bold tracking-widest text-xs">MESA</span> : game.community.map((c,i) => <Card key={i} card={c}/>)}
           </div>
           <div className="mt-1 text-green-200 italic h-5 text-sm">{game.msg}</div>
        </div>

        {/* --- ZONA JUGADOR (Abajo - Ajustado bottom-2) --- */}
        <div className="absolute bottom-2 w-full flex flex-col items-center px-4 z-10">
           <div className="flex gap-2 mb-3">
             {game.pHand.map((c,i) => <div key={i} className="hover:-translate-y-2 transition"><Card card={c}/></div>)}
           </div>
           <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-full bg-slate-800 border-4 ${game.turn==='player' ? 'border-green-400' : 'border-slate-600'}`}><User size={24}/></div>
              <span className="text-lg sm:text-xl font-bold bg-black/40 px-4 py-1 rounded-full border border-green-500/30">Tú: <span className="text-green-400">${game.chips.p}</span></span>
           </div>
           
           {/* BOTONES */}
           {game.phase === 'start' || game.phase === 'over' ? (
              <button onClick={deal} className="bg-yellow-500 text-black px-8 py-3 rounded-full font-bold hover:bg-yellow-400 flex items-center gap-2 shadow-lg transform active:scale-95 transition">
                 <RefreshCw size={20}/> {game.phase==='start'?'JUGAR':'REINICIAR'}
              </button>
           ) : !game.winner && (
              <div className="flex gap-2 w-full max-w-sm">
                 <button disabled={game.turn!=='player'} onClick={() => checkWinner('b')} className="flex-1 bg-red-600 py-3 rounded-xl font-bold shadow-lg border-b-4 border-red-800 hover:bg-red-500 disabled:opacity-50 text-xs sm:text-sm">FOLD</button>
                 <button disabled={game.turn!=='player'} onClick={nextPhase} className="flex-1 bg-blue-600 py-3 rounded-xl font-bold shadow-lg border-b-4 border-blue-800 hover:bg-blue-500 disabled:opacity-50 text-xs sm:text-sm">CHECK</button>
                 <button disabled={game.turn!=='player'} onClick={() => setGame(p=>({...p, pot: p.pot+100, chips:{...p.chips, p:p.chips.p-100}, msg: 'Subiste 100', turn: 'bot'}))} className="flex-1 bg-yellow-500 text-black py-3 rounded-xl font-bold shadow-lg border-b-4 border-yellow-700 hover:bg-yellow-400 disabled:opacity-50 text-xs sm:text-sm">RAISE</button>
              </div>
           )}
        </div>

        {/* --- PANTALLA DE RESULTADO (OVERLAY) --- */}
        {game.winner && (
            <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 animate-in fade-in p-4">
                <div className="bg-yellow-500 text-black p-6 rounded-2xl shadow-2xl text-center border-4 border-white w-full max-w-md">
                    <Trophy size={48} className="mx-auto mb-2"/>
                    <h2 className="text-3xl font-black mb-1">{game.winner === 'Jugador' ? '¡GANASTE!' : (game.winner === 'Empate' ? 'EMPATE' : 'PERDISTE')}</h2>
                    <p className="font-bold opacity-80 mb-4">{game.msg}</p>
                    
                    {/* AQUÍ MOSTRAMOS LAS CARTAS DEL BOT EXPLÍCITAMENTE */}
                    <div className="bg-black/20 rounded-xl p-3 mb-4">
                        <p className="text-xs font-bold uppercase tracking-widest mb-2 opacity-70">Mano del Bot:</p>
                        <div className="flex justify-center gap-2">
                            {game.bHand.map((c,i) => <Card key={i} card={c} hidden={false}/>)}
                        </div>
                    </div>

                    <button onClick={deal} className="bg-black text-white px-8 py-3 rounded-full font-bold hover:bg-slate-800 w-full transform active:scale-95 transition">
                        Siguiente Mano
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}