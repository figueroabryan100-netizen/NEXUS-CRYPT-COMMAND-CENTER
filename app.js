/*
===========================================================
NEXUS CRYPT V4
AI TRADING COMMAND CENTER
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

PAPER / SIMULATION ONLY
NO BROKER
NO REAL MONEY
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

    // Maximum notional exposure as a percentage of equity.
    maxExposurePercent: 20,

    // Risk allocation per paper trade.
    riskPerTrade: 0.02,

    // Automatic market cycle.
    cycleInterval: 4000,

    // Ledger protection.
    maxLedgerEntries: 100
  };

  // ======================================================
  // AGENTS
  // ======================================================

  const AGENTS = {
    VESKA: {
      name: "VESKA",
      role: "EXECUTION",
      defaultStatus: "READY"
    },

    NORO: {
      name: "NORO",
      role: "FAIR VALUE",
      defaultStatus: "READY"
    },

    LUMEN: {
      name: "LUMEN",
      role: "SENTIMENT",
      defaultStatus: "READY"
    },

    TIDAL: {
      name: "TIDAL",
      role: "MARKET SCANNER",
      defaultStatus: "SCANNING"
    },

    ZEPHR: {
      name: "ZEPHR",
      role: "LIQUIDITY",
      defaultStatus: "READY"
    },

    RUNE: {
      name: "RUNE",
      role: "RISK GATE",
      defaultStatus: "GUARDING"
    },

    OKAPI: {
      name: "OKAPI",
      role: "EXPOSURE",
      defaultStatus: "MONITORING"
    },

    MARIN: {
      name: "MARIN",
      role: "LIQUIDATION",
      defaultStatus: "STANDBY"
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
    direction: "HOLD",

    market: {
      symbol: "BTC",
      price: 0,
      change24h: 0,
      fairValue: 0,
      volume: 0,
      liquidity: 0,
      sentiment: 0,
      volatility: 0
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
      cycles: 0,
      lastCycle: null
    }
  };

  // ======================================================
  // DOM
  // ======================================================

  const $ = (selector) => document.querySelector(selector);

  const $$ = (selector) =>
    Array.from(document.querySelectorAll(selector));

  // ======================================================
  // UTILITY
  // ======================================================

  function random(min, max) {
    return Math.random() * (max - min) + min;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function round(value, decimals = 2) {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }

  function formatMoney(value) {
    const number = Number(value) || 0;

    return (
      "$" +
      number.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    );
  }

  function formatPercent(value) {
    return `${Number(value || 0).toFixed(2)}%`;
  }

  function formatPrice(value) {
    return formatMoney(value);
  }

  function timeNow() {
    return new Date().toLocaleTimeString();
  }

  function signedPercent(value) {
    const number = Number(value) || 0;

    if (number > 0) {
      return `+${number.toFixed(2)}%`;
    }

    return `${number.toFixed(2)}%`;
  }

  function signedMoney(value) {
    const number = Number(value) || 0;

    if (number > 0) {
      return `+${formatMoney(number)}`;
    }

    return formatMoney(number);
  }

  // ======================================================
  // MARKET INITIALIZATION
  // ======================================================

  function initializeMarket() {
    state.market.price = random(95000, 115000);

    state.market.change24h = random(-3.5, 3.5);

    state.market.volume = random(20, 50);

    state.market.liquidity = random(75, 98);

    state.market.sentiment = random(-35, 35);

    state.market.volatility = random(1, 6);

    state.market.fairValue =
      state.market.price *
      random(0.985, 1.015);

    state.position.currentPrice =
      state.market.price;
  }

  // ======================================================
  // MARKET ENGINE
  // ======================================================

  function updateMarket() {
    const volatilityFactor =
      Math.max(0.35, state.market.volatility / 4);

    const movement =
      random(-0.65, 0.65) *
      volatilityFactor;

    state.market.price *=
      1 + movement / 100;

    state.market.change24h = clamp(
      state.market.change24h +
        random(-0.30, 0.30) *
          volatilityFactor,
      -15,
      15
    );

    state.market.volume = clamp(
      state.market.volume +
        random(-3, 3),
      5,
      100
    );

    state.market.liquidity = clamp(
      state.market.liquidity +
        random(-2.5, 2.5),
      15,
      100
    );

    state.market.sentiment = clamp(
      state.market.sentiment +
        random(-9, 9),
      -100,
      100
    );

    state.market.volatility = clamp(
      state.market.volatility +
        random(-0.5, 0.5),
      0.5,
      12
    );

    /*
      Fair value intentionally moves independently
      from spot price so NORO has something to analyze.
    */

    state.market.fairValue =
      state.market.price *
      random(0.982, 1.018);

    state.position.currentPrice =
      state.market.price;

    calculateUnrealizedPnl();
  }

  // ======================================================
  // NORO — FAIR VALUE
  // ======================================================

  function runNORO() {
    const difference =
      ((state.market.price -
        state.market.fairValue) /
        state.market.fairValue) *
      100;

    if (difference <= -1) {
      return {
        agent: "NORO",
        signal: "BUY",
        score: clamp(
          72 + Math.abs(difference) * 7,
          72,
          98
        )
      };
    }

    if (difference >= 1) {
      return {
        agent: "NORO",
        signal: "SELL",
        score: clamp(
          72 + Math.abs(difference) * 7,
          72,
          98
        )
      };
    }

    return {
      agent: "NORO",
      signal: "HOLD",
      score: random(55, 78)
    };
  }

  // ======================================================
  // LUMEN — SENTIMENT
  // ======================================================

  function runLUMEN() {
    const sentiment =
      state.market.sentiment;

    if (sentiment >= 25) {
      return {
        agent: "LUMEN",
        signal: "BUY",
        score: clamp(
          60 + sentiment * 0.38,
          60,
          98
        )
      };
    }

    if (sentiment <= -25) {
      return {
        agent: "LUMEN",
        signal: "SELL",
        score: clamp(
          60 + Math.abs(sentiment) * 0.38,
          60,
          98
        )
      };
    }

    return {
      agent: "LUMEN",
      signal: "HOLD",
      score: random(55, 78)
    };
  }

  // ======================================================
  // TIDAL — MARKET SCANNER
  // ======================================================

  function runTIDAL() {
    const momentum =
      state.market.change24h;

    if (momentum >= 1.2) {
      return {
        agent: "TIDAL",
        signal: "BUY",
        score: clamp(
          70 + momentum * 2,
          70,
          96
        )
      };
    }

    if (momentum <= -1.2) {
      return {
        agent: "TIDAL",
        signal: "SELL",
        score: clamp(
          70 + Math.abs(momentum) * 2,
          70,
          96
        )
      };
    }

    return {
      agent: "TIDAL",
      signal: "HOLD",
      score: random(55, 76)
    };
  }

  // ======================================================
  // ZEPHR — LIQUIDITY
  // ======================================================

  function runZEPHR() {
    const liquidity =
      state.market.liquidity;

    if (liquidity < 40) {
      return {
        agent: "ZEPHR",
        signal: "BLOCK",
        score: 95
      };
    }

    if (liquidity < 55) {
      return {
        agent: "ZEPHR",
        signal: "CAUTION",
        score: 72
      };
    }

    return {
      agent: "ZEPHR",
      signal: "PASS",
      score: liquidity
    };
  }

  // ======================================================
  // RUNE — RISK
  // ======================================================

  function runRUNE() {
    const riskScore =
      Math.abs(
        state.market.change24h
      ) +
      state.market.volatility * 1.5 +
      (100 - state.market.liquidity) / 8;

    if (riskScore > 15) {
      return {
        agent: "RUNE",
        signal: "BLOCK",
        score: clamp(
          80 + riskScore,
          80,
          99
        )
      };
    }

    if (riskScore > 10) {
      return {
        agent: "RUNE",
        signal: "CAUTION",
        score: 76
      };
    }

    return {
      agent: "RUNE",
      signal: "PASS",
      score: random(82, 98)
    };
  }

  // ======================================================
  // OKAPI — EXPOSURE
  // ======================================================

  function getExposurePercent() {
    const notional =
      Math.abs(
        state.position.quantity *
          state.market.price
      );

    if (state.equity <= 0) {
      return 100;
    }

    return (
      notional /
      state.equity
    ) * 100;
  }

  function runOKAPI() {
    const exposure =
      getExposurePercent();

    if (
      exposure >
      CONFIG.maxExposurePercent
    ) {
      return {
        agent: "OKAPI",
        signal: "REDUCE",
        score: 96
      };
    }

    return {
      agent: "OKAPI",
      signal: "PASS",
      score: random(82, 98)
    };
  }

  // ======================================================
  // MARIN — LIQUIDATION
  // ======================================================

  function runMARIN() {
    const exposure =
      getExposurePercent();

    const drawdown =
      state.equity <
      CONFIG.startingBalance
        ? (
            (CONFIG.startingBalance -
              state.equity) /
            CONFIG.startingBalance
          ) * 100
        : 0;

    if (
      exposure >
        CONFIG.maxExposurePercent ||
      drawdown >= 5
    ) {
      return {
        agent: "MARIN",
        signal: "LIQUIDATE",
        score: 98
      };
    }

    return {
      agent: "MARIN",
      signal: "STANDBY",
      score: random(80, 95)
    };
  }

  // ======================================================
  // CONSENSUS
  // ======================================================

  function calculateConsensus() {
    const directional =
      state.signals.filter(
        signal =>
          signal.signal === "BUY" ||
          signal.signal === "SELL"
      );

    if (!directional.length) {
      state.consensus = 50;
      state.direction = "HOLD";
      return;
    }

    const buyScore =
      directional
        .filter(
          signal =>
            signal.signal === "BUY"
        )
        .reduce(
          (total, signal) =>
            total + signal.score,
          0
        );

    const sellScore =
      directional
        .filter(
          signal =>
            signal.signal === "SELL"
        )
        .reduce(
          (total, signal) =>
            total + signal.score,
          0
        );

    const total =
      buyScore + sellScore;

    if (total <= 0) {
      state.consensus = 50;
      state.direction = "HOLD";
      return;
    }

    if (buyScore > sellScore) {
      state.direction = "BUY";

      state.consensus =
        (buyScore / total) * 100;
    } else if (sellScore > buyScore) {
      state.direction = "SELL";

      state.consensus =
        (sellScore / total) * 100;
    } else {
      state.direction = "HOLD";
      state.consensus = 50;
    }
  }

  // ======================================================
  // RISK GATE
  // ======================================================

  function riskGate() {
    const rune =
      state.signals.find(
        signal =>
          signal.agent === "RUNE"
      );

    const zephr =
      state.signals.find(
        signal =>
          signal.agent === "ZEPHR"
      );

    const okapi =
      state.signals.find(
        signal =>
          signal.agent === "OKAPI"
      );

    const marin =
      state.signals.find(
        signal =>
          signal.agent === "MARIN"
      );

    if (
      rune?.signal === "BLOCK"
    ) {
      addLedger(
        "RUNE",
        "RISK BLOCK",
        "Market risk exceeded safe threshold."
      );

      return false;
    }

    if (
      zephr?.signal === "BLOCK"
    ) {
      addLedger(
        "ZEPHR",
        "LIQUIDITY BLOCK",
        "Insufficient market liquidity."
      );

      return false;
    }

    if (
      marin?.signal === "LIQUIDATE"
    ) {
      if (state.position.side) {
        closePosition(
          "MARIN",
          "LIQUIDATION"
        );
      }

      return false;
    }

    if (
      okapi?.signal === "REDUCE"
    ) {
      if (state.position.side) {
        closePosition(
          "OKAPI",
          "EXPOSURE REDUCTION"
        );
      }

      return false;
    }

    return true;
  }

  // ======================================================
  // POSITION SIZE
  // ======================================================

  function calculateTradeQuantity() {
    const riskCapital =
      state.equity *
      CONFIG.riskPerTrade;

    if (
      state.market.price <= 0
    ) {
      return 0;
    }

    return (
      riskCapital /
      state.market.price
    );
  }

  // ======================================================
  // PAPER EXECUTION — VESKA
  // ======================================================

  function executePaperTrade(
    direction,
    source = "VESKA"
  ) {
    if (
      direction !== "BUY" &&
      direction !== "SELL"
    ) {
      return;
    }

    if (
      state.consensus <
      CONFIG.consensusRequired
    ) {
      addLedger(
        source,
        "TRADE BLOCKED",
        `Consensus ${state.consensus.toFixed(
          1
        )}% < ${CONFIG.consensusRequired}%`
      );

      return;
    }

    const quantity =
      calculateTradeQuantity();

    if (quantity <= 0) {
      return;
    }

    // --------------------------------------------
    // BUY
    // --------------------------------------------

    if (direction === "BUY") {
      if (
        state.position.side ===
        "SHORT"
      ) {
        closePosition(
          "VESKA",
          "REVERSE TO LONG"
        );
      }

      if (
        !state.position.side
      ) {
        state.position.side =
          "LONG";

        state.position.quantity =
          quantity;

        state.position.entryPrice =
          state.market.price;

        state.position.currentPrice =
          state.market.price;

        addLedger(
          "VESKA",
          "PAPER BUY",
          `${quantity.toFixed(
            6
          )} BTC @ ${formatPrice(
            state.market.price
          )}`
        );
      }
    }

    // --------------------------------------------
    // SELL / SHORT
    // --------------------------------------------

    if (direction === "SELL") {
      if (
        state.position.side ===
        "LONG"
      ) {
        closePosition(
          "VESKA",
          "REVERSE TO SHORT"
        );
      }

      if (
        !state.position.side
      ) {
        state.position.side =
          "SHORT";

        state.position.quantity =
          quantity;

        state.position.entryPrice =
          state.market.price;

        state.position.currentPrice =
          state.market.price;

        addLedger(
          "VESKA",
          "PAPER SELL",
          `${quantity.toFixed(
            6
          )} BTC @ ${formatPrice(
            state.market.price
          )}`
        );
      }
    }

    calculateUnrealizedPnl();
  }

  // ======================================================
  // P&L
  // ======================================================

  function calculateUnrealizedPnl() {
    if (
      !state.position.side ||
      state.position.quantity <= 0
    ) {
      state.unrealizedPnl = 0;

      state.pnl =
        state.realizedPnl;

      state.equity =
        CONFIG.startingBalance +
        state.realizedPnl;

      return;
    }

    const entry =
      state.position.entryPrice;

    const current =
      state.market.price;

    const quantity =
      state.position.quantity;

    if (
      state.position.side ===
      "LONG"
    ) {
      state.unrealizedPnl =
        (current - entry) *
        quantity;
    }

    if (
      state.position.side ===
      "SHORT"
    ) {
      state.unrealizedPnl =
        (entry - current) *
        quantity;
    }

    state.pnl =
      state.realizedPnl +
      state.unrealizedPnl;

    state.equity =
      CONFIG.startingBalance +
      state.pnl;

    state.balance =
      state.equity;
  }

  // ======================================================
  // CLOSE POSITION — MARIN
  // ======================================================

  function closePosition(
    agent = "MARIN",
    reason = "POSITION CLOSED"
  ) {
    if (
      !state.position.side
    ) {
      return;
    }

    calculateUnrealizedPnl();

    const closingPnl =
      state.unrealizedPnl;

    const side =
      state.position.side;

    const quantity =
      state.position.quantity;

    state.realizedPnl +=
      closingPnl;

    state.position.side =
      null;

    state.position.quantity =
      0;

    state.position.entryPrice =
      0;

    state.position.currentPrice =
      0;

    state.unrealizedPnl = 0;

    state.pnl =
      state.realizedPnl;

    state.equity =
      CONFIG.startingBalance +
      state.realizedPnl;

    state.balance =
      state.equity;

    addLedger(
      agent,
      reason,
      `${side} ${quantity.toFixed(
        6
      )} BTC | P&L ${signedMoney(
        closingPnl
      )}`
    );
  }

  // ======================================================
  // FULL AGENT CYCLE
  // ======================================================

  function runAgentCycle() {
    state.signals = [];

    // Analysis agents
    state.signals.push(
      runNORO()
    );

    state.signals.push(
      runLUMEN()
    );

    state.signals.push(
      runTIDAL()
    );

    state.signals.push(
      runZEPHR()
    );

    state.signals.push(
      runRUNE()
    );

    state.signals.push(
      runOKAPI()
    );

    state.signals.push(
      runMARIN()
    );

    calculateConsensus();
  }

  // ======================================================
  // TRADING CYCLE
  // ======================================================

  function tradingCycle() {
    if (
      !state.system.running
    ) {
      return;
    }

    updateMarket();

    runAgentCycle();

    const approved =
      riskGate();

    if (approved) {
      executePaperTrade(
        state.direction
      );
    }

    state.system.cycles += 1;

    state.system.lastCycle =
      timeNow();

    render();

    console.log(
      `[NEXUS] Cycle ${
        state.system.cycles
      } | ${
        state.direction
      } | Consensus ${
        state.consensus.toFixed(1)
      }%`
    );
  }

  // ======================================================
  // LEDGER
  // ======================================================

  function addLedger(
    agent,
    action,
    details
  ) {
    state.ledger.unshift({
      time: timeNow(),
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
  // AGENT STATUS
  // ======================================================

  function getAgentStatus(
    agent
  ) {
    const signal =
      state.signals.find(
        item =>
          item.agent === agent
      );

    if (!signal) {
      return AGENTS[agent]
        .defaultStatus;
    }

    switch (
      signal.signal
    ) {
      case "BUY":
        return "BUY SIGNAL";

      case "SELL":
        return "SELL SIGNAL";

      case "HOLD":
        return "HOLD";

      case "PASS":
        return "PASS";

      case "BLOCK":
        return "BLOCKED";

      case "CAUTION":
        return "CAUTION";

      case "REDUCE":
        return "REDUCE";

      case "LIQUIDATE":
        return "LIQUIDATE";

      default:
        return AGENTS[agent]
          .defaultStatus;
    }
  }

  // ======================================================
  // RENDER AGENTS
  // ======================================================

  function renderAgents() {
    $$(".agent-card").forEach(
      card => {
        const agent =
          card.dataset.agent;

        if (
          !AGENTS[agent]
        ) {
          return;
        }

        const name =
          card.querySelector(
            ".agent-name"
          );

        const role =
          card.querySelector(
            ".agent-role"
          );

        const status =
          card.querySelector(
            "strong"
          );

        if (name) {
          name.textContent =
            AGENTS[agent].name;
        }

        if (role) {
          role.textContent =
            AGENTS[agent].role;
        }

        if (status) {
          status.textContent =
            getAgentStatus(
              agent
            );
        }
      }
    );
  }

  // ======================================================
  // RENDER MARKET
  // ======================================================

  function renderMarket() {
    const priceElements =
      $$("#price");

    priceElements.forEach(
      element => {
        element.textContent =
          formatPrice(
            state.market.price
          );
      }
    );

    const change =
      $("#change");

    if (change) {
      change.textContent =
        signedPercent(
          state.market.change24h
        );
    }

    const fairValue =
      $("#fair-value");

    if (fairValue) {
      fairValue.textContent =
        formatPrice(
          state.market.fairValue
        );
    }

    const volume =
      $("#volume");

    if (volume) {
      volume.textContent =
        `${state.market.volume.toFixed(
          1
        )}B`;
    }

    const liquidity =
      $("#liquidity");

    if (liquidity) {
      liquidity.textContent =
        formatPercent(
          state.market.liquidity
        );
    }

    const sentiment =
      $("#sentiment");

    if (sentiment) {
      sentiment.textContent =
        `${Math.round(
          state.market.sentiment
        )}`;
    }

    const signal =
      $("#signal");

    if (signal) {
      signal.textContent =
        state.direction;
    }
  }

  // ======================================================
  // RENDER STATS
  // ======================================================

  function renderStats() {
    const vitality =
      $("#vitality");

    if (vitality) {
      const vitalityValue =
        clamp(
          100 -
            Math.abs(
              state.market.change24h
            ) *
              2,
          50,
          100
        );

      vitality.textContent =
        `${vitalityValue.toFixed(
          0
        )}%`;
    }

    const consensus =
      $("#consensus");

    if (consensus) {
      consensus.textContent =
        `${state.consensus.toFixed(
          1
        )}%`;
    }

    const equity =
      $("#equity");

    if (equity) {
      equity.textContent =
        formatMoney(
          state.equity
        );
    }

    const pnl =
      $("#pnl");

    if (pnl) {
      pnl.textContent =
        signedMoney(
          state.pnl
        );
    }

    const cycles =
      $("#cycles");

    if (cycles) {
      cycles.textContent =
        state.system.cycles;
    }

    const cycle =
      $("#cycle");

    if (cycle) {
      cycle.textContent =
        state.system.cycles;
    }

    const lastCycle =
      $("#last-cycle");

    if (lastCycle) {
      lastCycle.textContent =
        state.system.lastCycle ||
        "—";
    }
  }

  // ======================================================
  // RENDER POSITION
  // ======================================================

  function renderPosition() {
    const position =
      $("#position");

    const currentPosition =
      $("#current-position");

    const entry =
      $("#entry");

    const unrealized =
      $("#unrealized");

    let label = "FLAT";

    if (
      state.position.side ===
      "LONG"
    ) {
      label = "LONG";
    }

    if (
      state.position.side ===
      "SHORT"
    ) {
      label = "SHORT";
    }

    if (position) {
      position.textContent =
        label;
    }

    if (currentPosition) {
      currentPosition.textContent =
        label;
    }

    if (entry) {
      entry.textContent =
        state.position.entryPrice
          ? formatPrice(
              state.position.entryPrice
            )
          : "—";
    }

    if (unrealized) {
      unrealized.textContent =
        signedMoney(
          state.unrealizedPnl
        );
    }
  }

  // ======================================================
  // RENDER LEDGER
  // ======================================================

  function renderLedger() {
    const ledger =
      $("#ledger");

    if (!ledger) {
      return;
    }

    if (
      !state.ledger.length
    ) {
      ledger.innerHTML = `
        <div class="ledger-entry">
          <span class="ledger-time">—</span>
          <strong>NEXUS</strong>
          <span>INITIALIZING</span>
          <small>Waiting for engine...</small>
        </div>
      `;

      return;
    }

    ledger.innerHTML =
      state.ledger
        .map(
          entry => `
            <div class="ledger-entry">

              <span class="ledger-time">
                ${escapeHTML(
                  entry.time
                )}
              </span>

              <strong>
                ${escapeHTML(
                  entry.agent
                )}
              </strong>

              <span>
                ${escapeHTML(
                  entry.action
                )}
              </span>

              <small>
                ${escapeHTML(
                  entry.details
                )}
              </small>

            </div>
          `
        )
        .join("");
  }

  // ======================================================
  // HTML ESCAPE
  // ======================================================

  function escapeHTML(value) {
    return String(value)
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );
  }

  // ======================================================
  // BUTTON CONTROLS
  // ======================================================

  function bindControls() {
    const buy =
      $("#buy");

    const sell =
      $("#sell");

    const close =
      $("#close");

    const pause =
      $("#pause");

    if (buy) {
      buy.addEventListener(
        "click",
        () => {
          executeManualTrade(
            "BUY"
          );
        }
      );
    }

    if (sell) {
      sell.addEventListener(
        "click",
        () => {
          executeManualTrade(
            "SELL"
          );
        }
      );
    }

    if (close) {
      close.addEventListener(
        "click",
        () => {
          if (
            state.position.side
          ) {
            closePosition(
              "MARIN",
              "MANUAL CLOSE"
            );

            render();
          } else {
            addLedger(
              "MARIN",
              "NO POSITION",
              "Nothing available to close."
            );
          }
        }
      );
    }

    if (pause) {
      pause.addEventListener(
        "click",
        () => {
          state.system.running =
            !state.system.running;

          pause.textContent =
            state.system.running
              ? "PAUSE"
              : "RESUME";

          addLedger(
            "NEXUS",
            state.system.running
              ? "ENGINE RESUMED"
              : "ENGINE PAUSED",
            state.system.running
              ? "Automatic trading cycle resumed."
              : "Automatic trading cycle paused."
          );
        }
      );
    }
  }

  // ======================================================
  // MANUAL PAPER TRADE
  // ======================================================

  function executeManualTrade(
    direction
  ) {
    if (
      state.market.price <= 0
    ) {
      initializeMarket();
    }

    /*
      Manual controls intentionally use
      the same consensus/risk architecture.
    */

    if (
      state.consensus <
      CONFIG.consensusRequired
    ) {
      addLedger(
        "VESKA",
        "MANUAL BLOCK",
        `Consensus ${state.consensus.toFixed(
          1
        )}% below ${CONFIG.consensusRequired}%`
      );

      return;
    }

    const approved =
      riskGate();

    if (!approved) {
      render();
      return;
    }

    executePaperTrade(
      direction,
      "VESKA"
    );

    render();
  }

  // ======================================================
  // SYSTEM BOOT
  // ======================================================

  function boot() {
    initializeMarket();

    render();

    bindControls();

    addLedger(
      "NEXUS",
      "SYSTEM ONLINE",
      "8-agent paper trading command center initialized."
    );

    addLedger(
      "TIDAL",
      "MARKET STREAM",
      `BTC initialized at ${formatPrice(
        state.market.price
      )}`
    );

    addLedger(
      "RUNE",
      "RISK GATE",
      `Consensus threshold set to ${CONFIG.consensusRequired}%.`
    );

    render();

    /*
      First real cycle shortly after boot,
      then continue automatically.
    */

    setTimeout(
      tradingCycle,
      1200
    );

    setInterval(
      tradingCycle,
      CONFIG.cycleInterval
    );
  }

  // ======================================================
  // MASTER RENDER
  // ======================================================

  function render() {
    calculateUnrealizedPnl();

    renderStats();

    renderMarket();

    renderAgents();

    renderPosition();

    renderLedger();
  }

  // ======================================================
  // START
  // ======================================================

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      boot
    );
  } else {
    boot();
  }

})();
