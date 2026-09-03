/*
===========================================================
NEXUS CRYPT V4 — AI TRADING COMMAND CENTER
PAPER / SIMULATION ENGINE
===========================================================

VESKA = Execution
NORO  = Fair Value
LUMEN = Sentiment
TIDAL = Market Scanner
ZEPHR = Liquidity
RUNE  = Risk
OKAPI = Exposure
MARIN = Liquidation

IMPORTANT:
This version is PAPER/SIMULATION ONLY.
It does NOT connect to a broker or move real money.
===========================================================
*/

(() => {
  "use strict";

  // ======================================================
  // CONFIGURATION
  // ======================================================

  const CONFIG = {
    startingBalance: 10000,
    consensusRequired: 76.8,
    maxRiskPerTrade: 0.02,
    simulationInterval: 4000,
    maxLedgerEntries: 100
  };

  // ======================================================
  // AGENTS
  // ======================================================

  const AGENTS = {
    VESKA: {
      name: "VESKA",
      role: "Execution",
      status: "READY"
    },

    NORO: {
      name: "NORO",
      role: "Fair Value",
      status: "READY"
    },

    LUMEN: {
      name: "LUMEN",
      role: "Sentiment",
      status: "READY"
    },

    TIDAL: {
      name: "TIDAL",
      role: "Market Scanner",
      status: "SCANNING"
    },

    ZEPHR: {
      name: "ZEPHR",
      role: "Liquidity",
      status: "READY"
    },

    RUNE: {
      name: "RUNE",
      role: "Risk",
      status: "GUARDING"
    },

    OKAPI: {
      name: "OKAPI",
      role: "Exposure",
      status: "MONITORING"
    },

    MARIN: {
      name: "MARIN",
      role: "Liquidation",
      status: "STANDBY"
    }
  };

  // ======================================================
  // STATE
  // ======================================================

  const state = {
    balance: CONFIG.startingBalance,
    equity: CONFIG.startingBalance,

    pnl: 0,
    realizedPnl: 0,
    unrealizedPnl: 0,

    consensus: 0,

    market: {
      symbol: "BTC",
      price: 0,
      change24h: 0,
      volume: 0,
      liquidity: 0,
      sentiment: 0,
      fairValue: 0
    },

    position: {
      side: null,
      quantity: 0,
      entryPrice: 0,
      currentPrice: 0
    },

    signals: [],

    ledger: [],

    system: {
      running: true,
      lastCycle: null,
      cycles: 0
    }
  };

  // ======================================================
  // UTILITY FUNCTIONS
  // ======================================================

  function random(min, max) {
    return Math.random() * (max - min) + min;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function formatMoney(value) {
    return "$" + Number(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function formatPercent(value) {
    return `${Number(value).toFixed(2)}%`;
  }

  function timestamp() {
    return new Date().toLocaleTimeString();
  }

  // ======================================================
  // MARKET SIMULATION
  // ======================================================

  function initializeMarket() {
    state.market.price = random(95000, 115000);
    state.market.change24h = random(-4, 4);
    state.market.volume = random(15, 45);
    state.market.liquidity = random(70, 99);

    state.market.fairValue =
      state.market.price * random(0.985, 1.015);

    state.market.sentiment = random(-100, 100);
  }

  function updateMarket() {
    const movement = random(-0.9, 0.9);

    state.market.price *= 1 + movement / 100;

    state.market.change24h = clamp(
      state.market.change24h + random(-0.35, 0.35),
      -15,
      15
    );

    state.market.volume = clamp(
      state.market.volume + random(-3, 3),
      5,
      100
    );

    state.market.liquidity = clamp(
      state.market.liquidity + random(-4, 4),
      20,
      100
    );

    state.market.sentiment = clamp(
      state.market.sentiment + random(-12, 12),
      -100,
      100
    );

    state.market.fairValue =
      state.market.price * random(0.985, 1.015);

    state.position.currentPrice = state.market.price;

    calculateUnrealizedPnl();
  }

  // ======================================================
  // AGENT ANALYSIS
  // ======================================================

  function runNORO() {
    const difference =
      ((state.market.price - state.market.fairValue) /
        state.market.fairValue) *
      100;

    if (difference < -1) {
      return {
        agent: "NORO",
        signal: "BUY",
        score: random(75, 96)
      };
    }

    if (difference > 1) {
      return {
        agent: "NORO",
        signal: "SELL",
        score: random(75, 96)
      };
    }

    return {
      agent: "NORO",
      signal: "HOLD",
      score: random(55, 80)
    };
  }

  function runLUMEN() {
    const sentiment = state.market.sentiment;

    if (sentiment > 25) {
      return {
        agent: "LUMEN",
        signal: "BUY",
        score: clamp(50 + sentiment / 2, 50, 98)
      };
    }

    if (sentiment < -25) {
      return {
        agent: "LUMEN",
        signal: "SELL",
        score: clamp(50 + Math.abs(sentiment) / 2, 50, 98)
      };
    }

    return {
      agent: "LUMEN",
      signal: "HOLD",
      score: random(55, 78)
    };
  }

  function runTIDAL() {
    const momentum = state.market.change24h;

    if (momentum > 1) {
      return {
        agent: "TIDAL",
        signal: "BUY",
        score: random(70, 94)
      };
    }

    if (momentum < -1) {
      return {
        agent: "TIDAL",
        signal: "SELL",
        score: random(70, 94)
      };
    }

    return {
      agent: "TIDAL",
      signal: "HOLD",
      score: random(55, 75)
    };
  }

  function runZEPHR() {
    const liquidity = state.market.liquidity;

    if (liquidity < 40) {
      return {
        agent: "ZEPHR",
        signal: "BLOCK",
        score: 90
      };
    }

    return {
      agent: "ZEPHR",
      signal: "PASS",
      score: liquidity
    };
  }

  function runRUNE() {
    const risk =
      Math.abs(state.market.change24h) +
      (100 - state.market.liquidity) / 10;

    if (risk > 10) {
      return {
        agent: "RUNE",
        signal: "BLOCK",
        score: random(80, 98)
      };
    }

    return {
      agent: "RUNE",
      signal: "PASS",
      score: random(80, 98)
    };
  }

  function runOKAPI() {
    const exposure =
      Math.abs(
        state.position.quantity * state.market.price
      );

    const exposurePercent =
      state.equity > 0
        ? (exposure / state.equity) * 100
        : 0;

    if (exposurePercent > 20) {
      return {
        agent: "OKAPI",
        signal: "REDUCE",
        score: 92
      };
    }

    return {
      agent: "OKAPI",
      signal: "PASS",
      score: random(80, 97)
    };
  }

  // ======================================================
  // CONSENSUS ENGINE
  // ======================================================

  function calculateConsensus() {
    const directionalSignals = state.signals.filter(
      signal =>
        signal.signal === "BUY" ||
        signal.signal === "SELL"
    );

    if (directionalSignals.length === 0) {
      state.consensus = random(50, 70);
      return;
    }

    const buyScore = directionalSignals
      .filter(s => s.signal === "BUY")
      .reduce((sum, s) => sum + s.score, 0);

    const sellScore = directionalSignals
      .filter(s => s.signal === "SELL")
      .reduce((sum, s) => sum + s.score, 0);

    const total =
      directionalSignals.reduce(
        (sum, s) => sum + s.score,
        0
      );

    const strongest =
      Math.max(buyScore, sellScore);

    state.consensus =
      total > 0 ? (strongest / total) * 100 : 0;
  }

  function getConsensusDirection() {
    const buys = state.signals.filter(
      s => s.signal === "BUY"
    ).length;

    const sells = state.signals.filter(
      s => s.signal === "SELL"
    ).length;

    if (buys > sells) return "BUY";
    if (sells > buys) return "SELL";

    return "HOLD";
  }

  // ======================================================
  // VESKA EXECUTION
  // ======================================================

  function executePaperTrade(direction) {
    if (direction === "HOLD") return;

    if (state.consensus < CONFIG.consensusRequired) {
      addLedger(
        "VESKA",
        "TRADE BLOCKED",
        `Consensus ${state.consensus.toFixed(
          1
        )}% below ${CONFIG.consensusRequired}%`
      );

      return;
    }

    const riskCapital =
      state.equity * CONFIG.maxRiskPerTrade;

    const quantity =
      riskCapital / state.market.price;

    if (direction === "BUY") {
      if (state.position.side === "SELL") {
        closePosition();
      }

      if (!state.position.side) {
        state.position.side = "LONG";
        state.position.quantity = quantity;
        state.position.entryPrice =
          state.market.price;

        addLedger(
          "VESKA",
          "PAPER BUY",
          `${quantity.toFixed(6)} ${state.market.symbol} @ ${formatMoney(
            state.market.price
          )}`
        );
      }
    }

    if (direction === "SELL") {
      if (state.position.side === "LONG") {
        closePosition();
      }

      if (!state.position.side) {
        state.position.side = "SHORT";
        state.position.quantity = quantity;
        state.position.entryPrice =
          state.market.price;

        addLedger(
          "VESKA",
          "PAPER SELL",
          `${quantity.toFixed(6)} ${state.market.symbol} @ ${formatMoney(
            state.market.price
          )}`
        );
      }
    }
  }

  // ======================================================
  // POSITION MANAGEMENT
  // ======================================================

  function calculateUnrealizedPnl() {
    if (!state.position.side) {
      state.unrealizedPnl = 0;
      return;
    }

    const entry = state.position.entryPrice;
    const current = state.market.price;
    const qty = state.position.quantity;

    if (state.position.side === "LONG") {
      state.unrealizedPnl =
        (current - entry) * qty;
    }

    if (state.position.side === "SHORT") {
      state.unrealizedPnl =
        (entry - current) * qty;
    }

    state.pnl =
      state.realizedPnl +
      state.unrealizedPnl;

    state.equity =
      CONFIG.startingBalance +
      state.pnl;
  }

  function closePosition() {
    if (!state.position.side) return;

    calculateUnrealizedPnl();

    state.realizedPnl += state.unrealizedPnl;

    addLedger(
      "MARIN",
      "POSITION CLOSED",
      `${state.position.side} | P&L ${formatMoney(
        state.unrealizedPnl
      )}`
    );

    state.position.side = null;
    state.position.quantity = 0;
    state.position.entryPrice = 0;
    state.position.currentPrice = 0;

    state.unrealizedPnl = 0;

    state.pnl = state.realizedPnl;

    state.equity =
      CONFIG.startingBalance +
      state.realizedPnl;
  }

  // ======================================================
  // RISK GATE
  // ======================================================

  function riskGate() {
    const rune = state.signals.find(
      s => s.agent === "RUNE"
    );

    const zephr = state.signals.find(
      s => s.agent === "ZEPHR"
    );

    if (!rune || !zephr) return false;

    if (rune.signal === "BLOCK") {
      addLedger(
        "RUNE",
        "RISK BLOCK",
        "Trade rejected by risk gate"
      );

      return false;
    }

    if (zephr.signal === "BLOCK") {
      addLedger(
        "ZEPHR",
        "LIQUIDITY BLOCK",
        "Insufficient market liquidity"
      );

      return false;
    }

    return true;
  }

  // ======================================================
  // LEDGER
  // ======================================================

  function addLedger(agent, action, details) {
    state.ledger.unshift({
      time: timestamp(),
      agent,
      action,
      details
    });

    if (
      state.ledger.length >
      CONFIG.maxLedgerEntries
    ) {
      state.ledger.pop();
    }

    renderLedger();
  }

  // ======================================================
  // TRADING CYCLE
  // ======================================================

  function tradingCycle() {
    if (!state.system.running) return;

    updateMarket();

    state.signals = [];

    state.signals.push(runNORO());
    state.signals.push(runLUMEN());
    state.signals.push(runTIDAL());
    state.signals.push(runZEPHR());
    state.signals.push(runRUNE());
    state.signals.push(runOKAPI());

    calculateConsensus();

    const direction =
      getConsensusDirection();

    const approved = riskGate();

    if (approved) {
      executePaperTrade(direction);
    }

    state.system.cycles++;
    state.system.lastCycle =
      timestamp();

    render();

    console.log(
      `[NEXUS] Cycle ${state.system.cycles} | ${direction} | Consensus ${state.consensus.toFixed(
        1
      )}%`
    );
  }

  // ======================================================
  // DOM HELPERS
  // ======================================================

  function setText(selectors, value) {
    for (const selector of selectors) {
      const element =
        document.querySelector(selector);

      if (element) {
        element.textContent = value;
        return;
      }
    }
  }

  // ======================================================
  // UI RENDERING
  // ======================================================

  function renderMarket() {
    setText(
      [
        "#price",
        "#market-price",
        "[data-market-price]"
      ],
      formatMoney(state.market.price)
    );

    setText(
      [
        "#change",
        "#market-change",
        "[data-market-change]"
      ],
      formatPercent(state.market.change24h)
    );

    setText(
      [
        "#volume",
        "[data-volume]"
      ],
      `${state.market.volume.toFixed(2)}B`
    );

    setText(
      [
        "#liquidity",
        "[data-liquidity]"
      ],
      `${state.market.liquidity.toFixed(1)}%`
    );

    setText(
      [
        "#fair-value",
        "[data-fair-value]"
      ],
      formatMoney(state.market.fairValue)
    );

    setText(
      [
        "#sentiment",
        "[data-sentiment]"
      ],
      `${state.market.sentiment.toFixed(0)}`
    );
  }

  function renderAccount() {
    setText(
      [
        "#balance",
        "#account-balance",
        "[data-balance]"
      ],
      formatMoney(state.balance)
    );

    setText(
      [
        "#equity",
        "#account-equity",
        "[data-equity]"
      ],
      formatMoney(state.equity)
    );

    setText(
      [
        "#pnl",
        "#profit-loss",
        "[data-pnl]"
      ],
      formatMoney(state.pnl)
    );

    setText(
      [
        "#consensus",
        "[data-consensus]"
      ],
      `${state.consensus.toFixed(1)}%`
    );
  }

  function renderPosition() {
    const positionText =
      state.position.side
        ? `${state.position.side} ${state.position.quantity.toFixed(
            6
          )} ${state.market.symbol}`
        : "FLAT";

    setText(
      [
        "#position",
        "#current-position",
        "[data-position]"
      ],
      positionText
    );

    setText(
      [
        "#entry",
        "#entry-price",
        "[data-entry]"
      ],
      state.position.entryPrice
        ? formatMoney(
            state.position.entryPrice
          )
        : "—"
    );

    setText(
      [
        "#unrealized",
        "#unrealized-pnl",
        "[data-unrealized]"
      ],
      formatMoney(
        state.unrealizedPnl
      )
    );
  }

  function renderAgents() {
    Object.values(AGENTS).forEach(agent => {
      const possibleSelectors = [
        `[data-agent="${agent.name}"]`,
        `#agent-${agent.name.toLowerCase()}`
      ];

      for (const selector of possibleSelectors) {
        const element =
          document.querySelector(selector);

        if (element) {
          const status =
            state.signals.find(
              s => s.agent === agent.name
            );

          if (status) {
            element.textContent =
              `${agent.name} — ${status.signal} ${status.score.toFixed(
                0
              )}%`;
          } else {
            element.textContent =
              `${agent.name} — ${agent.status}`;
          }

          break;
        }
      }
    });
  }

  function renderLedger() {
    const containers = [
      "#ledger",
      "#trade-ledger",
      "#activity",
      "[data-ledger]"
    ];

    let container = null;

    for (const selector of containers) {
      container =
        document.querySelector(selector);

      if (container) break;
    }

    if (!container) return;

    container.innerHTML =
      state.ledger
        .slice(0, 20)
        .map(entry => `
          <div class="ledger-entry">
            <span class="ledger-time">
              ${entry.time}
            </span>

            <strong>
              ${entry.agent}
            </strong>

            <span>
              ${entry.action}
            </span>

            <small>
              ${entry.details}
            </small>
          </div>
        `)
        .join("");
  }

  function render() {
    renderMarket();
    renderAccount();
    renderPosition();
    renderAgents();

    setText(
      [
        "#cycle",
        "#cycles",
        "[data-cycles]"
      ],
      state.system.cycles
    );

    setText(
      [
        "#last-cycle",
        "[data-last-cycle]"
      ],
      state.system.lastCycle || "—"
    );

    setText(
      [
        "#signal",
        "#trade-signal",
        "[data-signal]"
      ],
      getConsensusDirection()
    );
  }

  // ======================================================
  // BUTTON CONTROLS
  // ======================================================

  function setupControls() {
    const buyButtons = document.querySelectorAll(
      "#buy, #paper-buy, [data-action='buy']"
    );

    buyButtons.forEach(button => {
      button.addEventListener(
        "click",
        () => {
          state.consensus = 100;

          if (riskGate()) {
            executePaperTrade("BUY");
            render();
          }
        }
      );
    });

    const sellButtons = document.querySelectorAll(
      "#sell, #paper-sell, [data-action='sell']"
    );

    sellButtons.forEach(button => {
      button.addEventListener(
        "click",
        () => {
          state.consensus = 100;

          if (riskGate()) {
            executePaperTrade("SELL");
            render();
          }
        }
      );
    });

    const closeButtons =
      document.querySelectorAll(
        "#close, #close-position, [data-action='close']"
      );

    closeButtons.forEach(button => {
      button.addEventListener(
        "click",
        () => {
          closePosition();
          render();
        }
      );
    });

    const pauseButtons =
      document.querySelectorAll(
        "#pause, #pause-engine, [data-action='pause']"
      );

    pauseButtons.forEach(button => {
      button.addEventListener(
        "click",
        () => {
          state.system.running =
            !state.system.running;

          button.textContent =
            state.system.running
              ? "PAUSE"
              : "RESUME";
        }
      );
    });
  }

  // ======================================================
  // START NEXUS
  // ======================================================

  function startNexus() {
    initializeMarket();

    addLedger(
      "NEXUS",
      "SYSTEM ONLINE",
      "Paper trading engine initialized"
    );

    addLedger(
      "RUNE",
      "RISK GATE ONLINE",
      `Consensus threshold ${CONFIG.consensusRequired}%`
    );

    setupControls();
    render();

    setInterval(
      tradingCycle,
      CONFIG.simulationInterval
    );

    console.log(
      "%c NEXUS CRYPT V4 ONLINE ",
      "font-weight:bold;"
    );

    console.log(
      "8-agent paper trading command center initialized."
    );
  }

  // ======================================================
  // PUBLIC API
  // ======================================================

  window.NEXUS = {
    state,
    agents: AGENTS,

    cycle: tradingCycle,

    buy: () => {
      state.consensus = 100;

      if (riskGate()) {
        executePaperTrade("BUY");
        render();
      }
    },

    sell: () => {
      state.consensus = 100;

      if (riskGate()) {
        executePaperTrade("SELL");
        render();
      }
    },

    close: () => {
      closePosition();
      render();
    },

    pause: () => {
      state.system.running = false;
    },

    resume: () => {
      state.system.running = true;
    }
  };

  // ======================================================
  // BOOT
  // ======================================================

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      startNexus
    );
  } else {
    startNexus();
  }

})();