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

  /* ======================================================
     CONFIGURATION
  ====================================================== */

  const CONFIG = {
    startingBalance: 10000,
    consensusRequired: 76.8,
    maxExposurePercent: 20,
    riskPerTrade: 0.02,
    cycleInterval: 4000,
    maxLedgerEntries: 100,
    initialBTC: 109915.06
  };

  const AGENTS = {
    VESKA: {
      role: "EXECUTION",
      color: "cyan"
    },
    NORO: {
      role: "FAIR VALUE",
      color: "blue"
    },
    LUMEN: {
      role: "SENTIMENT",
      color: "yellow"
    },
    TIDAL: {
      role: "MARKET SCANNER",
      color: "cyan"
    },
    ZEPHR: {
      role: "LIQUIDITY",
      color: "green"
    },
    RUNE: {
      role: "RISK GATE",
      color: "red"
    },
    OKAPI: {
      role: "EXPOSURE",
      color: "blue"
    },
    MARIN: {
      role: "LIQUIDATION",
      color: "red"
    }
  };

  /* ======================================================
     STATE
  ====================================================== */

  const state = {
    running: true,
    cycle: 0,

    market: {
      price: CONFIG.initialBTC,
      previousPrice: CONFIG.initialBTC,
      change24h: -0.13,
      fairValue: CONFIG.initialBTC + 183.74,
      volume: 23.7,
      liquidity: 79.44,
      sentiment: -1
    },

    account: {
      cash: CONFIG.startingBalance,
      realizedPnL: 0,
      fees: 0
    },

    position: {
      side: null,
      quantity: 0,
      entry: 0,
      openedAt: null
    },

    signals: {
      NORO: null,
      LUMEN: null,
      TIDAL: null,
      ZEPHR: null,
      RUNE: null,
      OKAPI: null,
      MARIN: null,
      VESKA: null
    },

    consensus: {
      direction: "HOLD",
      percentage: 50,
      votes: {
        BUY: 0,
        SELL: 0,
        HOLD: 0
      }
    },

    ledger: [],

    stats: {
      wins: 0,
      losses: 0,
      trades: 0
    }
  };

  /* ======================================================
     DOM HELPERS
  ====================================================== */

  const $ = (selector) => document.querySelector(selector);

  const $$ = (selector) => [
    ...document.querySelectorAll(selector)
  ];

  function setText(selector, value) {
    $$(selector).forEach((el) => {
      el.textContent = value;
    });
  }

  function formatMoney(value) {
    return Number(value || 0).toLocaleString("en-US", {
      style: "currency",
      currency: "USD"
    });
  }

  function formatNumber(value, decimals = 2) {
    return Number(value || 0).toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function nowTime() {
    return new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function random(min, max) {
    return Math.random() * (max - min) + min;
  }

  /* ======================================================
     MARKET ENGINE
  ====================================================== */

  function updateMarket() {
    state.market.previousPrice = state.market.price;

    /*
      Small randomized market movement.
      This intentionally behaves like a paper-market simulator.
    */

    const volatility = random(-0.004, 0.004);

    state.market.price =
      state.market.price * (1 + volatility);

    state.market.price = Math.max(
      1000,
      state.market.price
    );

    state.market.change24h += random(-0.08, 0.08);
    state.market.change24h = clamp(
      state.market.change24h,
      -8,
      8
    );

    state.market.fairValue =
      state.market.price *
      (1 + random(-0.004, 0.004));

    state.market.volume =
      clamp(
        state.market.volume + random(-0.7, 0.7),
        5,
        100
      );

    state.market.liquidity =
      clamp(
        state.market.liquidity + random(-2.5, 2.5),
        20,
        99
      );

    state.market.sentiment =
      clamp(
        state.market.sentiment + random(-1, 1),
        -100,
        100
      );
  }

  /* ======================================================
     AGENT: NORO
     FAIR VALUE
  ====================================================== */

  function runNORO() {
    const difference =
      ((state.market.fairValue -
        state.market.price) /
        state.market.price) * 100;

    let signal = "HOLD";

    if (difference > 0.15) {
      signal = "BUY";
    } else if (difference < -0.15) {
      signal = "SELL";
    }

    return {
      signal,
      score: Math.abs(difference),
      reason:
        `Fair value ${difference >= 0 ? "+" : ""}${difference.toFixed(2)}% from market`
    };
  }

  /* ======================================================
     AGENT: LUMEN
     SENTIMENT
  ====================================================== */

  function runLUMEN() {
    const sentiment =
      state.market.sentiment;

    let signal = "HOLD";

    if (sentiment > 20) {
      signal = "BUY";
    } else if (sentiment < -20) {
      signal = "SELL";
    }

    return {
      signal,
      score: Math.abs(sentiment),
      reason:
        `Sentiment index ${sentiment.toFixed(1)}`
    };
  }

  /* ======================================================
     AGENT: TIDAL
     MARKET SCANNER
  ====================================================== */

  function runTIDAL() {
    const momentum =
      ((state.market.price -
        state.market.previousPrice) /
        state.market.previousPrice) * 100;

    let signal = "HOLD";

    if (momentum > 0.12) {
      signal = "BUY";
    } else if (momentum < -0.12) {
      signal = "SELL";
    }

    return {
      signal,
      score: Math.abs(momentum),
      reason:
        `Short-term momentum ${momentum >= 0 ? "+" : ""}${momentum.toFixed(3)}%`
    };
  }

  /* ======================================================
     AGENT: ZEPHR
     LIQUIDITY
  ====================================================== */

  function runZEPHR() {
    const liquidity =
      state.market.liquidity;

    let signal = "CLEAR";

    if (liquidity < 35) {
      signal = "BLOCK";
    } else if (liquidity < 55) {
      signal = "CAUTION";
    }

    return {
      signal,
      score: liquidity,
      reason:
        `Liquidity ${liquidity.toFixed(2)}%`
    };
  }

  /* ======================================================
     AGENT: RUNE
     RISK
  ====================================================== */

  function runRUNE() {
    const positionValue =
      state.position.quantity *
      state.market.price;

    const equity =
      state.account.cash +
      positionValue;

    const riskPercent =
      equity > 0
        ? (positionValue / equity) * 100
        : 0;

    let signal = "CLEAR";

    if (riskPercent >= 20) {
      signal = "BLOCK";
    } else if (riskPercent >= 12) {
      signal = "CAUTION";
    }

    return {
      signal,
      score: riskPercent,
      reason:
        `Portfolio risk ${riskPercent.toFixed(2)}%`
    };
  }

  /* ======================================================
     AGENT: OKAPI
     EXPOSURE
  ====================================================== */

  function runOKAPI() {
    const positionValue =
      state.position.quantity *
      state.market.price;

    const totalEquity =
      state.account.cash +
      positionValue;

    const exposure =
      totalEquity > 0
        ? (positionValue / totalEquity) * 100
        : 0;

    let signal = "CLEAR";

    if (exposure >= CONFIG.maxExposurePercent) {
      signal = "BLOCK";
    } else if (exposure >= 12) {
      signal = "CAUTION";
    }

    return {
      signal,
      score: exposure,
      reason:
        `Exposure ${exposure.toFixed(2)}%`
    };
  }

  /* ======================================================
     AGENT: MARIN
     LIQUIDATION
  ====================================================== */

  function runMARIN() {
    if (!state.position.side) {
      return {
        signal: "STANDBY",
        score: 0,
        reason: "No active position"
      };
    }

    const unrealized =
      getUnrealizedPnL();

    const equity =
      getEquity();

    const drawdown =
      equity > 0
        ? (unrealized / equity) * 100
        : 0;

    if (drawdown <= -5) {
      return {
        signal: "LIQUIDATE",
        score: Math.abs(drawdown),
        reason:
          `Drawdown ${drawdown.toFixed(2)}%`
      };
    }

    return {
      signal: "STANDBY",
      score: Math.abs(drawdown),
      reason:
        `Position stable ${drawdown >= 0 ? "+" : ""}${drawdown.toFixed(2)}%`
    };
  }

  /* ======================================================
     CONSENSUS ENGINE
  ====================================================== */

  function calculateConsensus() {
    const votes = {
      BUY: 0,
      SELL: 0,
      HOLD: 0
    };

    [
      "NORO",
      "LUMEN",
      "TIDAL"
    ].forEach((agent) => {
      const signal =
        state.signals[agent]?.signal;

      if (signal === "BUY") {
        votes.BUY++;
      } else if (signal === "SELL") {
        votes.SELL++;
      } else {
        votes.HOLD++;
      }
    });

    const total =
      votes.BUY +
      votes.SELL +
      votes.HOLD;

    let direction = "HOLD";
    let percentage = 50;

    if (total > 0) {
      if (
        votes.BUY >= votes.SELL &&
        votes.BUY > votes.HOLD
      ) {
        direction = "BUY";
        percentage =
          (votes.BUY / total) * 100;
      } else if (
        votes.SELL > votes.BUY &&
        votes.SELL > votes.HOLD
      ) {
        direction = "SELL";
        percentage =
          (votes.SELL / total) * 100;
      } else {
        direction = "HOLD";
        percentage =
          (votes.HOLD / total) * 100;
      }
    }

    state.consensus = {
      direction,
      percentage,
      votes
    };

    return state.consensus;
  }

  /* ======================================================
     RISK GATE
  ====================================================== */

  function riskGate() {
    const {
      direction,
      percentage
    } = state.consensus;

    if (direction === "HOLD") {
      return {
        approved: false,
        reason: "Consensus is HOLD"
      };
    }

    if (
      percentage <
      CONFIG.consensusRequired
    ) {
      return {
        approved: false,
        reason:
          `Consensus ${percentage.toFixed(1)}% below ${CONFIG.consensusRequired}%`
      };
    }

    if (
      state.signals.ZEPHR?.signal === "BLOCK"
    ) {
      return {
        approved: false,
        reason: "ZEPHR blocked: insufficient liquidity"
      };
    }

    if (
      state.signals.RUNE?.signal === "BLOCK"
    ) {
      return {
        approved: false,
        reason: "RUNE blocked: excessive risk"
      };
    }

    if (
      state.signals.OKAPI?.signal === "BLOCK"
    ) {
      return {
        approved: false,
        reason: "OKAPI blocked: excessive exposure"
      };
    }

    if (
      state.signals.MARIN?.signal === "LIQUIDATE"
    ) {
      return {
        approved: false,
        reason: "MARIN requested liquidation"
      };
    }

    return {
      approved: true,
      reason:
        `Consensus approved at ${percentage.toFixed(1)}%`
    };
  }

  /* ======================================================
     AGENT CYCLE
  ====================================================== */

  function runAgentCycle() {
    state.signals.NORO =
      runNORO();

    state.signals.LUMEN =
      runLUMEN();

    state.signals.TIDAL =
      runTIDAL();

    state.signals.ZEPHR =
      runZEPHR();

    state.signals.RUNE =
      runRUNE();

    state.signals.OKAPI =
      runOKAPI();

    state.signals.MARIN =
      runMARIN();

    calculateConsensus();

    const gate =
      riskGate();

    state.signals.VESKA = {
      signal:
        gate.approved
          ? `EXECUTE ${state.consensus.direction}`
          : "WAIT",
      score:
        state.consensus.percentage,
      reason:
        gate.reason
    };

    return gate;
  }

  /* ======================================================
     ACCOUNTING
  ====================================================== */

  function getUnrealizedPnL() {
    if (!state.position.side) {
      return 0;
    }

    const price =
      state.market.price;

    const entry =
      state.position.entry;

    const qty =
      state.position.quantity;

    if (state.position.side === "LONG") {
      return (price - entry) * qty;
    }

    if (state.position.side === "SHORT") {
      return (entry - price) * qty;
    }

    return 0;
  }

  function getEquity() {
    const positionValue =
      state.position.quantity *
      state.market.price;

    return (
      state.account.cash +
      positionValue +
      getUnrealizedPnL()
    );
  }

  /* ======================================================
     PAPER TRADE EXECUTION
  ====================================================== */

  function executePaperTrade(direction) {
    if (
      direction !== "BUY" &&
      direction !== "SELL"
    ) {
      return false;
    }

    /*
      Do not stack multiple positions.
      Opposite direction closes the current position first.
    */

    if (state.position.side) {
      const sameDirection =
        (
          direction === "BUY" &&
          state.position.side === "LONG"
        ) ||
        (
          direction === "SELL" &&
          state.position.side === "SHORT"
        );

      if (sameDirection) {
        return false;
      }

      closePosition("REVERSAL");
    }

    const equity =
      getEquity();

    const riskCapital =
      equity *
      CONFIG.riskPerTrade;

    const quantity =
      riskCapital /
      state.market.price;

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      return false;
    }

    const side =
      direction === "BUY"
        ? "LONG"
        : "SHORT";

    state.position = {
      side,
      quantity,
      entry: state.market.price,
      openedAt: Date.now()
    };

    state.stats.trades++;

    addLedger(
      "VESKA",
      `${direction} EXECUTED`,
      `${quantity.toFixed(6)} BTC @ ${formatMoney(state.market.price)}`
    );

    return true;
  }

  /* ======================================================
     CLOSE POSITION
  ====================================================== */

  function closePosition(reason = "MANUAL") {
    if (!state.position.side) {
      return false;
    }

    const pnl =
      getUnrealizedPnL();

    state.account.realizedPnL += pnl;

    if (pnl >= 0) {
      state.stats.wins++;
    } else {
      state.stats.losses++;
    }

    const side =
      state.position.side;

    const qty =
      state.position.quantity;

    addLedger(
      "MARIN",
      "POSITION CLOSED",
      `${side} ${qty.toFixed(6)} BTC | P&L ${formatMoney(pnl)} | ${reason}`
    );

    state.position = {
      side: null,
      quantity: 0,
      entry: 0,
      openedAt: null
    };

    return true;
  }

  /* ======================================================
     LEDGER
  ====================================================== */

  function addLedger(
    agent,
    action,
    details
  ) {
    state.ledger.unshift({
      time: nowTime(),
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
  }

  /* ======================================================
     MAIN TRADING CYCLE
  ====================================================== */

  function tradingCycle() {
    if (!state.running) {
      return;
    }

    updateMarket();

    const gate =
      runAgentCycle();

    /*
      MARIN liquidation has priority.
    */

    if (
      state.signals.MARIN?.signal ===
      "LIQUIDATE"
    ) {
      closePosition("MARIN RISK CONTROL");
    }

    /*
      Execute only when all gates approve.
    */

    if (
      gate.approved &&
      (
        state.consensus.direction === "BUY" ||
        state.consensus.direction === "SELL"
      )
    ) {
      executePaperTrade(
        state.consensus.direction
      );
    }

    state.cycle++;

    addLedger(
      "NEXUS",
      "CYCLE COMPLETE",
      `${state.consensus.direction} | ${state.consensus.percentage.toFixed(1)}% consensus`
    );

    render();
  }

  /* ======================================================
     RENDER: HEADER/STATS
  ====================================================== */

  function renderStats() {
    const equity =
      getEquity();

    const unrealized =
      getUnrealizedPnL();

    const totalPnL =
      state.account.realizedPnL +
      unrealized;

    setText(
      "#vitality",
      "100%"
    );

    setText(
      "#consensus",
      `${state.consensus.percentage.toFixed(1)}%`
    );

    setText(
      "#equity",
      formatMoney(equity)
    );

    setText(
      "#pnl",
      formatMoney(totalPnL)
    );

    setText(
      "#cycles",
      state.cycle
    );

    setText(
      "#last-cycle",
      nowTime()
    );

    const consensusElements =
      $$("#consensus");

    consensusElements.forEach((el) => {
      if (
        state.consensus.percentage >=
        CONFIG.consensusRequired
      ) {
        el.style.color = "var(--green)";
      } else {
        el.style.color = "var(--yellow)";
      }
    });

    /*
      Add a live consensus meter underneath
      the existing consensus number.
    */

    let meter =
      $("#nexus-consensus-meter");

    if (!meter) {
      const target =
        $("#consensus");

      if (target) {
        meter =
          document.createElement("div");

        meter.id =
          "nexus-consensus-meter";

        meter.style.height = "4px";
        meter.style.width = "100%";
        meter.style.marginTop = "8px";
        meter.style.background =
          "rgba(255,255,255,.08)";
        meter.style.borderRadius = "99px";
        meter.style.overflow = "hidden";

        const bar =
          document.createElement("div");

        bar.id =
          "nexus-consensus-bar";

        bar.style.height = "100%";
        bar.style.width = "0%";
        bar.style.transition =
          "width .3s ease";

        meter.appendChild(bar);

        target.parentElement?.appendChild(meter);
      }
    }

    const bar =
      $("#nexus-consensus-bar");

    if (bar) {
      bar.style.width =
        `${state.consensus.percentage}%`;

      if (
        state.consensus.percentage >=
        CONFIG.consensusRequired
      ) {
        bar.style.background =
          "var(--green)";
      } else {
        bar.style.background =
          "var(--yellow)";
      }
    }
  }

  /* ======================================================
     RENDER: MARKET
  ====================================================== */

  function renderMarket() {
    setText(
      "#price",
      formatMoney(state.market.price)
    );

    setText(
      "#change",
      `${state.market.change24h >= 0 ? "+" : ""}${state.market.change24h.toFixed(2)}%`
    );

    setText(
      "#fair-value",
      formatMoney(state.market.fairValue)
    );

    setText(
      "#volume",
      `${state.market.volume.toFixed(1)}B`
    );

    setText(
      "#liquidity",
      `${state.market.liquidity.toFixed(2)}%`
    );

    setText(
      "#sentiment",
      state.market.sentiment.toFixed(0)
    );

    const signal =
      state.consensus.direction;

    setText(
      "#signal",
      signal
    );

    const signalElements =
      $$("#signal");

    signalElements.forEach((el) => {
      if (signal === "BUY") {
        el.style.color =
          "var(--green)";
      } else if (signal === "SELL") {
        el.style.color =
          "var(--red)";
      } else {
        el.style.color =
          "var(--yellow)";
      }
    });
  }

  /* ======================================================
     RENDER: POSITION
  ====================================================== */

  function renderPosition() {
    if (!state.position.side) {
      setText(
        "#position",
        "FLAT"
      );

      setText(
        "#current-position",
        "NO POSITION"
      );

      setText(
        "#entry",
        "—"
      );

      setText(
        "#unrealized",
        "$0.00"
      );

      return;
    }

    setText(
      "#position",
      state.position.side
    );

    setText(
      "#current-position",
      state.position.side
    );

    setText(
      "#entry",
      formatMoney(
        state.position.entry
      )
    );

    setText(
      "#unrealized",
      formatMoney(
        getUnrealizedPnL()
      )
    );
  }

  /* ======================================================
     RENDER: AGENTS
  ====================================================== */

  function renderAgents() {
    $$(".agent-card").forEach((card) => {
      const agentName =
        card.dataset.agent;

      if (!agentName) {
        return;
      }

      const signal =
        state.signals[agentName];

      if (!signal) {
        return;
      }

      /*
        Look for common status elements.
      */

      const status =
        card.querySelector(
          ".agent-status, .status, [data-status]"
        );

      const detail =
        card.querySelector(
          ".agent-detail, .detail, [data-detail]"
        );

      if (status) {
        status.textContent =
          signal.signal;
      }

      if (detail) {
        detail.textContent =
          signal.reason;
      }

      /*
        Also update any text elements that
        explicitly contain the status.
      */

      const statusNodes =
        card.querySelectorAll(
          "[data-agent-status]"
        );

      statusNodes.forEach((node) => {
        node.textContent =
          signal.signal;
      });

      /*
        Agent state classes.
      */

      card.classList.remove(
        "buy",
        "sell",
        "hold",
        "blocked",
        "active"
      );

      if (
        signal.signal === "BUY" ||
        signal.signal === "EXECUTE BUY"
      ) {
        card.classList.add("buy");
      }

      if (
        signal.signal === "SELL" ||
        signal.signal === "EXECUTE SELL"
      ) {
        card.classList.add("sell");
      }

      if (
        signal.signal === "BLOCK" ||
        signal.signal === "LIQUIDATE"
      ) {
        card.classList.add("blocked");
      }

      if (
        signal.signal === "HOLD" ||
        signal.signal === "WAIT" ||
        signal.signal === "CLEAR" ||
        signal.signal === "STANDBY"
      ) {
        card.classList.add("hold");
      }

      card.classList.add("active");
    });
  }

  /* ======================================================
     RENDER: LEDGER
  ====================================================== */

  function renderLedger() {
    const ledger =
      $("#ledger");

    if (!ledger) {
      return;
    }

    /*
      Support either a table body or normal container.
    */

    const rows =
      state.ledger
        .slice(0, 25)
        .map((entry) => {
          return `
            <div class="nexus-ledger-row"
                 style="
                   display:grid;
                   grid-template-columns:
                     70px 70px 1fr;
                   gap:8px;
                   padding:8px 0;
                   border-bottom:
                     1px solid rgba(255,255,255,.06);
                   font-size:12px;
                 ">
              <span style="opacity:.6">
                ${entry.time}
              </span>

              <strong>
                ${entry.agent}
              </strong>

              <span>
                <strong>
                  ${entry.action}
                </strong>
                <br>
                <span style="opacity:.65">
                  ${entry.details}
                </span>
              </span>
            </div>
          `;
        })
        .join("");

    if (
      ledger.tagName === "TBODY"
    ) {
      ledger.innerHTML =
        state.ledger
          .slice(0, 25)
          .map((entry) => `
            <tr>
              <td>${entry.time}</td>
              <td>${entry.agent}</td>
              <td>${entry.action}</td>
              <td>${entry.details}</td>
            </tr>
          `)
          .join("");
    } else {
      ledger.innerHTML = rows;
    }
  }

  /* ======================================================
     RENDER CYCLE
  ====================================================== */

  function renderCycle() {
    setText(
      "#cycle",
      state.cycle
    );
  }

  function render() {
    renderStats();
    renderMarket();
    renderPosition();
    renderAgents();
    renderLedger();
    renderCycle();

    /*
      Update pause button text.
    */

    const pause =
      $("#pause");

    if (pause) {
      pause.textContent =
        state.running
          ? "PAUSE"
          : "RESUME";
    }
  }

  /* ======================================================
     MANUAL CONTROLS
  ====================================================== */

  function manualTrade(direction) {
    const gate =
      runAgentCycle();

    if (!gate.approved) {
      addLedger(
        "NEXUS",
        `MANUAL ${direction} BLOCKED`,
        gate.reason
      );

      render();

      return;
    }

    executePaperTrade(
      direction
    );

    render();
  }

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
        () => manualTrade("BUY")
      );
    }

    if (sell) {
      sell.addEventListener(
        "click",
        () => manualTrade("SELL")
      );
    }

    if (close) {
      close.addEventListener(
        "click",
        () => {
          closePosition("MANUAL CLOSE");
          render();
        }
      );
    }

    if (pause) {
      pause.addEventListener(
        "click",
        () => {
          state.running =
            !state.running;

          addLedger(
            "NEXUS",
            state.running
              ? "SYSTEM RESUMED"
              : "SYSTEM PAUSED",
            state.running
              ? "Automatic cycles resumed"
              : "Automatic trading cycles paused"
          );

          render();
        }
      );
    }
  }

  /* ======================================================
     STARTUP
  ====================================================== */

  function boot() {
    /*
      Initial agent pass.
    */

    runAgentCycle();

    addLedger(
      "NEXUS",
      "SYSTEM ONLINE",
      "8-agent paper trading command center initialized"
    );

    addLedger(
      "NEXUS",
      "PAPER MODE",
      "No broker connection / no real money"
    );

    render();

    /*
      Automatic trading cycle.
    */

    setInterval(
      tradingCycle,
      CONFIG.cycleInterval
    );
  }

  /* ======================================================
     START
  ====================================================== */

  bindControls();
  boot();

})();