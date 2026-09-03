/* =========================================================
   NEXUS CRYPT V4 — AI TRADING COMMAND CENTER
   app.js

   PAPER/SIMULATION ENGINE
   ---------------------------------------------------------
   VESKA  = Execution
   NORO   = Fair Value
   LUMEN  = Sentiment
   TIDAL  = Market Scanner
   ZEPHR  = Liquidity
   RUNE   = Risk
   OKAPI  = Exposure
   MARIN  = Liquidation

   Architecture:
   MARKET STREAM
        ↓
      TIDAL
        ↓
    8 AGENTS
        ↓
   CONSENSUS
        ↓
    RUNE GATE
        ↓
   VESKA EXECUTION
        ↓
   PAPER LEDGER

   LIVE execution is intentionally NOT automatic.
   ========================================================= */

(() => {
  "use strict";

  /* =======================================================
     CONFIG
     ======================================================= */

  const CONFIG = {
    mode: "PAPER",

    consensusThreshold: 70,

    maxContracts: 25,

    maxExposurePct: 20,

    minCash: 50,

    updateInterval: 2500,

    ledgerLimit: 40,

    telemetryLimit: 100
  };


  /* =======================================================
     AGENT DEFINITIONS
     ======================================================= */

  const AGENTS = [
    {
      id: "VESKA",
      role: "EXECUTION",
      weight: 1.0,
      color: "cyan"
    },

    {
      id: "NORO",
      role: "FAIR VALUE",
      weight: 1.15,
      color: "green"
    },

    {
      id: "LUMEN",
      role: "SENTIMENT",
      weight: 0.95,
      color: "purple"
    },

    {
      id: "TIDAL",
      role: "MARKET SCANNER",
      weight: 1.05,
      color: "blue"
    },

    {
      id: "ZEPHR",
      role: "LIQUIDITY",
      weight: 0.9,
      color: "yellow"
    },

    {
      id: "RUNE",
      role: "RISK",
      weight: 1.3,
      color: "red"
    },

    {
      id: "OKAPI",
      role: "EXPOSURE",
      weight: 1.1,
      color: "orange"
    },

    {
      id: "MARIN",
      role: "LIQUIDATION",
      weight: 1.15,
      color: "red"
    }
  ];


  /* =======================================================
     STATE
     ======================================================= */

  const state = {
    running: true,

    market: {
      ticker: "NEXUS-DEMO",
      price: 0.52,
      fairValue: 0.55,
      sentiment: 0.12,
      volatility: 0.18,
      liquidity: 0.78,
      volume: 4200
    },

    portfolio: {
      cash: 10000,
      equity: 10000,
      exposure: 0,
      position: 0,
      pnl: 0
    },

    agents: {},

    consensus: {
      score: 0,
      approvals: 0,
      rejections: 0,
      action: "HOLD",
      veto: false,
      reason: ""
    },

    telemetry: [],

    ledger: [],

    cycles: 0,

    trades: 0,

    signals: 0
  };


  /* =======================================================
     INITIALIZE AGENTS
     ======================================================= */

  AGENTS.forEach(agent => {
    state.agents[agent.id] = {
      id: agent.id,
      role: agent.role,
      vote: "HOLD",
      confidence: 50,
      reason: "Awaiting market cycle.",
      latency: Math.floor(Math.random() * 30) + 5,
      active: true
    };
  });


  /* =======================================================
     DOM HELPERS
     ======================================================= */

  const $ = id => document.getElementById(id);

  const qs = selector => document.querySelector(selector);

  const qsa = selector => [...document.querySelectorAll(selector)];


  function setText(id, value) {
    const element = $(id);

    if (element) {
      element.textContent = value;
    }
  }


  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }


  function random(min, max) {
    return Math.random() * (max - min) + min;
  }


  /* =======================================================
     MARKET ENGINE
     ======================================================= */

  function updateMarket() {

    const drift = random(-0.025, 0.025);

    state.market.price = clamp(
      state.market.price + drift,
      0.02,
      0.98
    );

    state.market.fairValue = clamp(
      state.market.fairValue + random(-0.012, 0.012),
      0.02,
      0.98
    );

    state.market.sentiment = clamp(
      state.market.sentiment + random(-0.08, 0.08),
      -1,
      1
    );

    state.market.volatility = clamp(
      state.market.volatility + random(-0.025, 0.025),
      0.03,
      0.8
    );

    state.market.liquidity = clamp(
      state.market.liquidity + random(-0.04, 0.04),
      0.05,
      1
    );

    state.market.volume = Math.max(
      100,
      Math.round(
        state.market.volume + random(-500, 700)
      )
    );
  }


  /* =======================================================
     TIDAL — MARKET SCANNER
     ======================================================= */

  function runTidal() {

    const momentum =
      state.market.price -
      state.market.fairValue;

    let vote = "HOLD";

    if (momentum < -0.025) {
      vote = "BUY";
    }

    if (momentum > 0.025) {
      vote = "SELL";
    }

    state.agents.TIDAL.vote = vote;

    state.agents.TIDAL.confidence =
      Math.round(
        clamp(
          55 +
          Math.abs(momentum) * 500 +
          state.market.liquidity * 10,
          40,
          97
        )
      );

    state.agents.TIDAL.reason =
      vote === "BUY"
        ? "Scanner detects price discount."
        : vote === "SELL"
          ? "Scanner detects price premium."
          : "No decisive market displacement.";
  }


  /* =======================================================
     NORO — FAIR VALUE
     ======================================================= */

  function runNoro() {

    const difference =
      state.market.fairValue -
      state.market.price;

    let vote = "HOLD";

    if (difference > 0.025) {
      vote = "BUY";
    }

    if (difference < -0.025) {
      vote = "SELL";
    }

    state.agents.NORO.vote = vote;

    state.agents.NORO.confidence =
      Math.round(
        clamp(
          58 + Math.abs(difference) * 450,
          45,
          98
        )
      );

    state.agents.NORO.reason =
      vote === "BUY"
        ? "Market price is below estimated fair value."
        : vote === "SELL"
          ? "Market price is above estimated fair value."
          : "Price is near estimated fair value.";
  }


  /* =======================================================
     LUMEN — SENTIMENT
     ======================================================= */

  function runLumen() {

    const sentiment =
      state.market.sentiment;

    let vote = "HOLD";

    if (sentiment > 0.25) {
      vote = "BUY";
    }

    if (sentiment < -0.25) {
      vote = "SELL";
    }

    state.agents.LUMEN.vote = vote;

    state.agents.LUMEN.confidence =
      Math.round(
        clamp(
          50 + Math.abs(sentiment) * 45,
          40,
          95
        )
      );

    state.agents.LUMEN.reason =
      vote === "BUY"
        ? "Positive sentiment detected."
        : vote === "SELL"
          ? "Negative sentiment detected."
          : "Sentiment remains neutral.";
  }


  /* =======================================================
     ZEPHR — LIQUIDITY
     ======================================================= */

  function runZephr() {

    const liquidity =
      state.market.liquidity;

    let vote = "HOLD";

    if (liquidity > 0.72) {
      vote = "BUY";
    }

    if (liquidity < 0.25) {
      vote = "SELL";
    }

    state.agents.ZEPHR.vote = vote;

    state.agents.ZEPHR.confidence =
      Math.round(
        clamp(
          45 + liquidity * 50,
          40,
          94
        )
      );

    state.agents.ZEPHR.reason =
      liquidity > 0.72
        ? "Healthy liquidity supports execution."
        : liquidity < 0.25
          ? "Thin liquidity increases execution risk."
          : "Liquidity is acceptable.";
  }


  /* =======================================================
     RUNE — RISK
     ======================================================= */

  function runRune() {

    const volatility =
      state.market.volatility;

    const exposure =
      state.portfolio.exposure;

    let vote = "BUY";

    let reason =
      "Risk parameters within limits.";

    let confidence = 78;

    if (volatility > 0.55) {

      vote = "HOLD";

      confidence = 92;

      reason =
        "VETO: volatility exceeds risk threshold.";
    }

    if (
      exposure >
      CONFIG.maxExposurePct
    ) {

      vote = "HOLD";

      confidence = 96;

      reason =
        "VETO: portfolio exposure limit reached.";
    }

    state.agents.RUNE.vote = vote;

    state.agents.RUNE.confidence =
      confidence;

    state.agents.RUNE.reason =
      reason;
  }


  /* =======================================================
     OKAPI — EXPOSURE
     ======================================================= */

  function runOkapi() {

    const exposure =
      state.portfolio.exposure;

    let vote = "BUY";

    if (
      exposure >
      CONFIG.maxExposurePct * 0.8
    ) {
      vote = "HOLD";
    }

    if (
      exposure >
      CONFIG.maxExposurePct
    ) {
      vote = "SELL";
    }

    state.agents.OKAPI.vote = vote;

    state.agents.OKAPI.confidence =
      Math.round(
        clamp(
          90 - exposure * 2,
          45,
          94
        )
      );

    state.agents.OKAPI.reason =
      vote === "BUY"
        ? "Portfolio has room for controlled exposure."
        : vote === "SELL"
          ? "Exposure requires reduction."
          : "Exposure approaching allocation limit.";
  }


  /* =======================================================
     MARIN — LIQUIDATION
     ======================================================= */

  function runMarin() {

    const pnl =
      state.portfolio.pnl;

    let vote = "HOLD";

    let reason =
      "No liquidation condition detected.";

    if (pnl < -500) {

      vote = "SELL";

      reason =
        "Drawdown threshold approaching liquidation.";
    }

    if (
      state.market.volatility >
      0.7
    ) {

      vote = "SELL";

      reason =
        "Extreme volatility detected.";
    }

    state.agents.MARIN.vote = vote;

    state.agents.MARIN.confidence =
      vote === "SELL"
        ? 93
        : 72;

    state.agents.MARIN.reason =
      reason;
  }


  /* =======================================================
     VESKA — EXECUTION
     ======================================================= */

  function runVeska() {

    const positiveVotes =
      Object.values(state.agents)
        .filter(a =>
          a.id !== "VESKA" &&
          a.vote === "BUY"
        )
        .length;

    const negativeVotes =
      Object.values(state.agents)
        .filter(a =>
          a.id !== "VESKA" &&
          a.vote === "SELL"
        )
        .length;

    let vote = "HOLD";

    if (positiveVotes > negativeVotes) {
      vote = "BUY";
    }

    if (negativeVotes > positiveVotes) {
      vote = "SELL";
    }

    state.agents.VESKA.vote = vote;

    state.agents.VESKA.confidence =
      Math.round(
        clamp(
          55 +
          Math.abs(
            positiveVotes -
            negativeVotes
          ) * 7,
          45,
          96
        )
      );

    state.agents.VESKA.reason =
      vote === "BUY"
        ? "Execution path favors controlled entry."
        : vote === "SELL"
          ? "Execution path favors controlled exit."
          : "No execution edge.";
  }


  /* =======================================================
     RUN ALL AGENTS
     ======================================================= */

  function runAgents() {

    runTidal();

    runNoro();

    runLumen();

    runZephr();

    runRune();

    runOkapi();

    runMarin();

    runVeska();
  }


  /* =======================================================
     CONSENSUS ENGINE
     ======================================================= */

  function calculateConsensus() {

    let buyWeight = 0;

    let sellWeight = 0;

    let totalWeight = 0;

    let approvals = 0;

    let rejections = 0;

    AGENTS.forEach(agent => {

      const decision =
        state.agents[agent.id];

      totalWeight += agent.weight;

      if (decision.vote === "BUY") {

        buyWeight +=
          agent.weight;

        approvals++;
      }

      if (decision.vote === "SELL") {

        sellWeight +=
          agent.weight;

        rejections++;
      }
    });

    const strongest =
      Math.max(
        buyWeight,
        sellWeight
      );

    const score =
      totalWeight > 0
        ? (strongest / totalWeight) * 100
        : 0;

    let action = "HOLD";

    if (
      buyWeight > sellWeight &&
      score >= CONFIG.consensusThreshold
    ) {
      action = "BUY";
    }

    if (
      sellWeight > buyWeight &&
      score >= CONFIG.consensusThreshold
    ) {
      action = "SELL";
    }

    const runeVeto =
      state.agents.RUNE.vote === "HOLD" &&
      state.market.volatility > 0.55;

    state.consensus.score =
      Number(score.toFixed(1));

    state.consensus.approvals =
      approvals;

    state.consensus.rejections =
      rejections;

    state.consensus.action =
      action;

    state.consensus.veto =
      runeVeto;

    state.consensus.reason =
      runeVeto
        ? "RUNE risk veto active."
        : action === "HOLD"
          ? "Consensus threshold not reached."
          : `${action} consensus reached.`;

    if (runeVeto) {
      state.consensus.action =
        "HOLD";
    }
  }


  /* =======================================================
     RISK ENGINE
     ======================================================= */

  function riskCheck(action, contracts) {

    if (
      !action ||
      action === "HOLD"
    ) {
      return {
        approved: false,
        reason: "No actionable consensus."
      };
    }

    if (
      state.consensus.veto
    ) {
      return {
        approved: false,
        reason: "RUNE veto."
      };
    }

    if (
      state.consensus.score <
      CONFIG.consensusThreshold
    ) {
      return {
        approved: false,
        reason: "Consensus below threshold."
      };
    }

    if (
      contracts >
      CONFIG.maxContracts
    ) {
      return {
        approved: false,
        reason: "Contract limit exceeded."
      };
    }

    const price =
      state.market.price;

    const notional =
      price * contracts * 100;

    const exposurePct =
      state.portfolio.equity > 0
        ? (notional /
            state.portfolio.equity) *
          100
        : 100;

    if (
      exposurePct >
      CONFIG.maxExposurePct
    ) {
      return {
        approved: false,
        reason: "Exposure limit exceeded."
      };
    }

    if (
      state.portfolio.cash <
      CONFIG.minCash
    ) {
      return {
        approved: false,
        reason: "Minimum cash reserve violated."
      };
    }

    return {
      approved: true,
      reason: "Risk checks passed.",
      notional,
      exposurePct
    };
  }


  /* =======================================================
     PAPER EXECUTION
     ======================================================= */

  function executePaperTrade() {

    const action =
      state.consensus.action;

    if (
      action === "HOLD"
    ) {
      return;
    }

    /*
      Small simulated position size.
      Real execution is deliberately
      not connected to this function.
    */

    const contracts =
      Math.min(
        5,
        CONFIG.maxContracts
      );

    const check =
      riskCheck(
        action,
        contracts
      );

    if (!check.approved) {

      addLedger(
        "RISK",
        check.reason,
        "BLOCKED"
      );

      return;
    }

    const price =
      state.market.price;

    const notional =
      price *
      contracts *
      100;

    if (action === "BUY") {

      state.portfolio.position +=
        contracts;

      state.portfolio.cash -=
        notional;
    }

    if (action === "SELL") {

      state.portfolio.position -=
        contracts;

      state.portfolio.cash +=
        notional;
    }

    state.portfolio.exposure =
      Math.min(
        CONFIG.maxExposurePct,
        Math.abs(
          state.portfolio.position *
          price *
          100 /
          Math.max(
            state.portfolio.equity,
            1
          ) *
          100
        )
      );

    state.portfolio.pnl =
      state.portfolio.equity -
      10000;

    state.trades++;

    addLedger(
      "VESKA",
      `${action} ${contracts} contracts @ ${price.toFixed(2)}`,
      "PAPER"
    );

    addTelemetry(
      "TRADE",
      `${action} ${contracts}`
    );
  }


  /* =======================================================
     PORTFOLIO MARK-TO-MARKET
     ======================================================= */

  function markPortfolio() {

    const positionValue =
      state.portfolio.position *
      state.market.price *
      100;

    state.portfolio.equity =
      state.portfolio.cash +
      positionValue;

    state.portfolio.pnl =
      state.portfolio.equity -
      10000;

    state.portfolio.exposure =
      state.portfolio.equity > 0
        ? Math.min(
            100,
            Math.abs(
              positionValue /
              state.portfolio.equity *
              100
            )
          )
        : 100;
  }


  /* =======================================================
     TELEMETRY
     ======================================================= */

  function addTelemetry(
    type,
    message
  ) {

    state.telemetry.unshift({

      time:
        new Date().toLocaleTimeString(),

      type,

      message
    });

    if (
      state.telemetry.length >
      CONFIG.telemetryLimit
    ) {
      state.telemetry.pop();
    }
  }


  /* =======================================================
     DECISION LEDGER
     ======================================================= */

  function addLedger(
    agent,
    action,
    result
  ) {

    state.ledger.unshift({

      time:
        new Date().toLocaleTimeString(),

      agent,

      action,

      result
    });

    if (
      state.ledger.length >
      CONFIG.ledgerLimit
    ) {
      state.ledger.pop();
    }
  }


  /* =======================================================
     UI — CONSENSUS
     ======================================================= */

  function renderConsensus() {

    const score =
      state.consensus.score;

    setText(
      "nexusConsensus",
      `${score.toFixed(1)}%`
    );

    setText(
      "nexusConsensusCount",
      `${state.consensus.approvals}/8 agents`
    );

    const fill =
      qs(".nexus-consensus-fill");

    if (fill) {

      fill.style.width =
        `${score}%`;
    }

    const action =
      state.consensus.action;

    const actionElement =
      $("nexusConsensusAction");

    if (actionElement) {

      actionElement.textContent =
        action;

      actionElement.className =
        action === "BUY"
          ? "nexus-green"
          : action === "SELL"
            ? "nexus-red"
            : "nexus-yellow";
    }
  }


  /* =======================================================
     UI — AGENTS
     ======================================================= */

  function renderAgents() {

    AGENTS.forEach(agent => {

      const data =
        state.agents[agent.id];

      const selectors = [

        `[data-agent="${agent.id}"]`,

        `#agent-${agent.id}`,

        `#${agent.id.toLowerCase()}`
      ];

      let card = null;

      for (
        const selector of selectors
      ) {

        card =
          qs(selector);

        if (card) break;
      }

      if (!card) return;

      const vote =
        card.querySelector(
          ".nexus-agent-vote"
        );

      const reason =
        card.querySelector(
          ".nexus-agent-why"
        );

      const status =
        card.querySelector(
          ".nexus-agent-status"
        );

      if (vote) {

        vote.textContent =
          `${data.vote} · ${data.confidence}%`;
      }

      if (reason) {

        reason.textContent =
          data.reason;
      }

      if (status) {

        status.textContent =
          data.active
            ? "ONLINE"
            : "OFFLINE";
      }
    });
  }


  /* =======================================================
     UI — MARKET
     ======================================================= */

  function renderMarket() {

    setText(
      "nexusMarketPrice",
      state.market.price.toFixed(3)
    );

    setText(
      "nexusFairValue",
      state.market.fairValue.toFixed(3)
    );

    setText(
      "nexusSentiment",
      `${Math.round(
        state.market.sentiment * 100
      )}`
    );

    setText(
      "nexusLiquidity",
      `${Math.round(
        state.market.liquidity * 100
      )}%`
    );
  }


  /* =======================================================
     UI — VAULT
     ======================================================= */

  function renderPortfolio() {

    setText(
      "nexusCash",
      `$${state.portfolio.cash.toFixed(2)}`
    );

    setText(
      "nexusEquity",
      `$${state.portfolio.equity.toFixed(2)}`
    );

    setText(
      "nexusPosition",
      state.portfolio.position
    );

    setText(
      "nexusExposure",
      `${state.portfolio.exposure.toFixed(1)}%`
    );

    const pnl =
      state.portfolio.pnl;

    setText(
      "nexusPnl",
      `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`
    );
  }


  /* =======================================================
     UI — TELEMETRY
     ======================================================= */

  function renderTelemetry() {

    const container =
      qs(".nexus-telemetry-log");

    if (!container) return;

    container.innerHTML =
      state.telemetry
        .slice(0, 15)
        .map(item => `
          <div class="nexus-ledger-entry">
            <span class="nexus-ledger-time">
              ${item.time}
            </span>

            <span class="nexus-ledger-action">
              ${item.type}: ${item.message}
            </span>

            <span class="nexus-ledger-result nexus-cyan">
              LIVE
            </span>
          </div>
        `)
        .join("");
  }


  /* =======================================================
     UI — DECISION LEDGER
     ======================================================= */

  function renderLedger() {

    const container =
      qs(".nexus-ledger");

    if (!container) return;

    container.innerHTML =
      state.ledger
        .slice(0, 20)
        .map(item => {

          const resultClass =
            item.result === "BLOCKED"
              ? "nexus-red"
              : item.result === "PAPER"
                ? "nexus-green"
                : "nexus-cyan";

          return `
            <div class="nexus-ledger-entry">

              <span class="nexus-ledger-time">
                ${item.time}
              </span>

              <span class="nexus-ledger-action">
                <strong>${item.agent}</strong>
                — ${item.action}
              </span>

              <span class="nexus-ledger-result ${resultClass}">
                ${item.result}
              </span>

            </div>
          `;
        })
        .join("");
  }


  /* =======================================================
     UI — SYSTEM
     ======================================================= */

  function renderSystem() {

    setText(
      "nexusPaperState",
      `● ${CONFIG.mode} MODE`
    );

    setText(
      "nexusCycles",
      state.cycles
    );

    setText(
      "nexusSignals",
      state.signals
    );

    setText(
      "nexusTrades",
      state.trades
    );

    setText(
      "nexusClock",
      new Date().toLocaleTimeString()
    );

    const vitality =
      state.consensus.veto
        ? 72
        : Math.round(
            clamp(
              88 +
              state.market.liquidity * 10 -
              state.market.volatility * 15,
              0,
              100
            )
          );

    setText(
      "nexusVitality",
      `${vitality}%`
    );

    setText(
      "nexusRisk",
      state.consensus.veto
        ? "VETO"
        : `${Math.round(
            state.market.volatility * 100
          )}%`
    );

    setText(
      "nexusExposureTop",
      `${state.portfolio.exposure.toFixed(1)}%`
    );
  }


  /* =======================================================
     MAIN CYCLE
     ======================================================= */

  function cycle() {

    if (!state.running) {
      return;
    }

    state.cycles++;

    updateMarket();

    runAgents();

    calculateConsensus();

    markPortfolio();

    /*
      We intentionally do NOT execute automatically
      on every consensus signal.

      The command center only evaluates the opportunity.
      A human confirmation should trigger execution.
    */

    if (
      state.consensus.action !== "HOLD"
    ) {

      state.signals++;

      addTelemetry(
        "SIGNAL",
        `${state.consensus.action} ${state.consensus.score}%`
      );
    }

    renderAll();
  }


  /* =======================================================
     MANUAL PAPER EXECUTION
     ======================================================= */

  function requestPaperExecution() {

    if (
      state.consensus.action === "HOLD"
    ) {

      addLedger(
        "SYSTEM",
        "Execution requested with no consensus.",
        "BLOCKED"
      );

      renderLedger();

      return;
    }

    addLedger(
      "RUNE",
      `${state.consensus.action} consensus ${state.consensus.score}%`,
      state.consensus.veto
        ? "BLOCKED"
        : "APPROVED"
    );

    if (
      state.consensus.veto
    ) {

      renderLedger();

      return;
    }

    executePaperTrade();

    markPortfolio();

    renderAll();
  }


  /* =======================================================
     KILL SWITCH
     ======================================================= */

  function killSwitch() {

    state.running = false;

    Object.values(
      state.agents
    ).forEach(agent => {

      agent.active = false;

      agent.vote = "HOLD";
    });

    addLedger(
      "SYSTEM",
      "EMERGENCY KILL SWITCH",
      "HALTED"
    );

    addTelemetry(
      "SYSTEM",
      "Trading engine halted."
    );

    renderAll();
  }


  /* =======================================================
     RESUME PAPER MODE
     ======================================================= */

  function resumePaper() {

    state.running = true;

    Object.values(
      state.agents
    ).forEach(agent => {

      agent.active = true;
    });

    addTelemetry(
      "SYSTEM",
      "Paper engine resumed."
    );

    renderAll();
  }


  /* =======================================================
     EVENT WIRING
     ======================================================= */

  function wireEvents() {

    const executeButtons =
      qsa(
        "[data-nexus-execute], #nexusExecute, #btnNexusExecute"
      );

    executeButtons.forEach(button => {

      button.addEventListener(
        "click",
        requestPaperExecution
      );
    });


    const killButtons =
      qsa(
        "[data-nexus-kill], #nexusKill, #btnNexusKill"
      );

    killButtons.forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const confirmed =
            window.confirm(
              "NEXUS EMERGENCY STOP?\n\nThis halts the local paper engine."
            );

          if (confirmed) {
            killSwitch();
          }
        }
      );
    });


    const resumeButtons =
      qsa(
        "[data-nexus-resume], #nexusResume"
      );

    resumeButtons.forEach(button => {

      button.addEventListener(
        "click",
        resumePaper
      );
    });
  }


  /* =======================================================
     RENDER EVERYTHING
     ======================================================= */

  function renderAll() {

    renderConsensus();

    renderAgents();

    renderMarket();

    renderPortfolio();

    renderTelemetry();

    renderLedger();

    renderSystem();
  }


  /* =======================================================
     PUBLIC NEXUS API
     ======================================================= */

  window.NEXUS = {

    config: CONFIG,

    agents: AGENTS,

    state,

    cycle,

    executePaperTrade:

      requestPaperExecution,

    killSwitch,

    resumePaper,

    getConsensus:
      () => ({
        ...state.consensus
      }),

    getPortfolio:
      () => ({
        ...state.portfolio
      }),

    getMarket:
      () => ({
        ...state.market
      })
  };


  /* =======================================================
     BOOT
     ======================================================= */

  function boot() {

    addTelemetry(
      "SYSTEM",
      "NEXUS CRYPT command center initialized."
    );

    addTelemetry(
      "SWARM",
      "8-agent network online."
    );

    addTelemetry(
      "MODE",
      "Paper trading safeguards active."
    );

    addLedger(
      "SYSTEM",
      "Command center boot",
      "READY"
    );

    wireEvents();

    renderAll();

    /*
      Start market simulation.
    */

    setInterval(
      cycle,
      CONFIG.updateInterval
    );

    /*
      Initial cycles.
    */

    cycle();

    cycle();
  }


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