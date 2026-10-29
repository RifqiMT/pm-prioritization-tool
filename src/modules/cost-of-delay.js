/**
 * Cost of Delay — plain-English estimate of what waiting costs.
 * Global: CostOfDelay
 *
 * Independent from Financial impact (separate inputs, currency, and result).
 *
 * Workshop model experts use (SAFe / Black Swan Farming, in money terms):
 *   Cost of waiting per period =
 *     value to users & business
 *     + time pressure
 *     + risk avoided or opportunity unlocked
 *   Estimated Cost of Delay =
 *     (cost of waiting per period × how long we delay)
 *     + any one-time hit from waiting
 *
 * Legacy keys still accepted: valuePerPeriod → userBusinessValue,
 * extraCostOfWaiting → oneTimeWaitingCost.
 */
const CostOfDelay = (function () {
  const DURATION_UNITS = ["week", "month", "quarter"];
  const DURATION_UNIT_LABELS = {
    week: "week",
    month: "month",
    quarter: "quarter"
  };
  const DURATION_UNIT_PLURAL = {
    week: "weeks",
    month: "months",
    quarter: "quarters"
  };

  function toFiniteNumberOrNull(value) {
    if (value == null || value === "") return null;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function nonNegativeOrNull(value) {
    const n = toFiniteNumberOrNull(value);
    return n != null && n >= 0 ? n : null;
  }

  function normalizeDurationUnit(unit) {
    const raw = String(unit || "")
      .trim()
      .toLowerCase();
    if (DURATION_UNITS.includes(raw)) return raw;
    if (raw === "weeks") return "week";
    if (raw === "months") return "month";
    if (raw === "quarters") return "quarter";
    return "month";
  }

  function unitWord(unit, count) {
    const key = normalizeDurationUnit(unit);
    return count === 1 ? DURATION_UNIT_LABELS[key] : DURATION_UNIT_PLURAL[key];
  }

  function sanitizeInputs(inputs) {
    const src = inputs && typeof inputs === "object" ? inputs : {};
    const legacyValue = nonNegativeOrNull(src.valuePerPeriod);
    const userBusinessValue =
      nonNegativeOrNull(src.userBusinessValue) != null
        ? nonNegativeOrNull(src.userBusinessValue)
        : legacyValue;
    const timePressureValue = nonNegativeOrNull(src.timePressureValue);
    const riskOpportunityValue = nonNegativeOrNull(src.riskOpportunityValue);
    const oneTimeWaitingCost =
      nonNegativeOrNull(src.oneTimeWaitingCost) != null
        ? nonNegativeOrNull(src.oneTimeWaitingCost)
        : nonNegativeOrNull(src.extraCostOfWaiting);
    const delayPeriods = nonNegativeOrNull(src.delayPeriods);

    return {
      userBusinessValue,
      timePressureValue,
      riskOpportunityValue,
      oneTimeWaitingCost,
      delayPeriods,
      durationUnit: normalizeDurationUnit(src.durationUnit),
      // Kept for CSV/round-trip compatibility with the first CoD ship.
      valuePerPeriod: userBusinessValue,
      extraCostOfWaiting: oneTimeWaitingCost
    };
  }

  /**
   * @param {object} inputs
   */
  function compute(inputs) {
    const sanitized = sanitizeInputs(inputs);

    const userBusinessValue = sanitized.userBusinessValue;
    const timePressureValue = sanitized.timePressureValue;
    const riskOpportunityValue = sanitized.riskOpportunityValue;
    const oneTime = sanitized.oneTimeWaitingCost != null ? sanitized.oneTimeWaitingCost : 0;
    const delayPeriods = sanitized.delayPeriods;
    const unit = sanitized.durationUnit;

    const rateParts = [userBusinessValue, timePressureValue, riskOpportunityValue].filter(
      (n) => n != null
    );
    const hasRateParts = rateParts.length > 0;
    const waitingPerPeriod = hasRateParts
      ? rateParts.reduce((sum, n) => sum + n, 0)
      : null;

    const hasDelay = delayPeriods != null && delayPeriods > 0;
    const delayedValue =
      waitingPerPeriod != null && hasDelay ? waitingPerPeriod * delayPeriods : null;

    let costOfDelayValue = null;
    if (delayedValue != null) {
      costOfDelayValue = delayedValue + oneTime;
    } else if (oneTime > 0) {
      costOfDelayValue = oneTime;
    }

    const explanation = buildExplanation({
      costOfDelayValue,
      userBusinessValue,
      timePressureValue,
      riskOpportunityValue,
      waitingPerPeriod,
      delayPeriods,
      unit,
      oneTime,
      hasDelay,
      delayedValue
    });

    const payload = {
      costOfDelayValue: Number.isFinite(costOfDelayValue) ? costOfDelayValue : null,
      breakdown: {
        userBusinessValue,
        timePressureValue,
        riskOpportunityValue,
        waitingPerPeriod,
        delayPeriods,
        durationUnit: unit,
        delayedValue,
        oneTimeWaitingCost: sanitized.oneTimeWaitingCost,
        // Legacy aliases for older UI/tests
        valuePerPeriod: waitingPerPeriod,
        extraCostOfWaiting: sanitized.oneTimeWaitingCost
      },
      explanation
    };
    payload.howToUse = buildHowToUse(payload);
    return payload;
  }

  function buildExplanation(parts) {
    const {
      costOfDelayValue,
      userBusinessValue,
      timePressureValue,
      riskOpportunityValue,
      waitingPerPeriod,
      delayPeriods,
      unit,
      oneTime,
      hasDelay,
      delayedValue
    } = parts;

    if (costOfDelayValue == null) {
      return "Start with Step 1, then add a likely delay in Step 2. A thoughtful estimate is enough for planning conversations.";
    }

    const amount = formatPlainNumber(costOfDelayValue);

    if (delayedValue == null && oneTime > 0) {
      return `If we wait, we face a one-time cost of about ${amount}. Add a likely delay to also include the ongoing cost of waiting each period.`;
    }

    const included = [];
    if (userBusinessValue != null && userBusinessValue > 0) {
      included.push("value people and the business miss");
    }
    if (timePressureValue != null && timePressureValue > 0) {
      included.push("timing pressure");
    }
    if (riskOpportunityValue != null && riskOpportunityValue > 0) {
      included.push("risk or closed opportunity");
    }

    const partsLabel =
      included.length > 1
        ? included.slice(0, -1).join(", ") + ", and " + included[included.length - 1]
        : included[0] || "waiting cost";

    const periodLabel = DURATION_UNIT_LABELS[unit];
    const delayLabel = hasDelay ? unitWord(unit, delayPeriods) : periodLabel;
    const rateText = `${formatPlainNumber(waitingPerPeriod)} per ${periodLabel}`;

    let narrative = `If we wait about ${formatPlainNumber(
      delayPeriods
    )} ${delayLabel}, Cost of Delay is roughly ${amount}.`;
    narrative += ` That comes from ${rateText} of ${partsLabel}`;
    if (hasDelay) {
      narrative += ` over ${formatPlainNumber(delayPeriods)} ${delayLabel}`;
    }
    if (oneTime > 0) {
      narrative += `, plus a one-time cost of ${formatPlainNumber(oneTime)}`;
    }
    narrative += ".";
    return narrative;
  }

  function buildHowToUse(result) {
    if (!result || result.costOfDelayValue == null) {
      return "How to use this: compare Cost of Delay across roadmaps when deciding what to start next. Higher Cost of Delay usually means waiting is more expensive — discuss that trade-off with the team.";
    }
    return "How to use this number: treat it as a planning signal for sequencing. Prefer starting higher Cost of Delay work sooner when capacity is limited, then validate the estimate with stakeholders.";
  }

  function formatPlainNumber(n) {
    if (!Number.isFinite(n)) return "—";
    return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function hasMeaningfulInputs(inputs) {
    const s = sanitizeInputs(inputs);
    if (s.userBusinessValue != null && s.userBusinessValue !== 0) return true;
    if (s.timePressureValue != null && s.timePressureValue !== 0) return true;
    if (s.riskOpportunityValue != null && s.riskOpportunityValue !== 0) return true;
    if (s.oneTimeWaitingCost != null && s.oneTimeWaitingCost !== 0) return true;
    if (s.delayPeriods != null && s.delayPeriods !== 0) return true;
    return false;
  }

  function validationMessage(inputs, currency) {
    const result = compute(inputs);
    if (result.costOfDelayValue != null && result.costOfDelayValue !== 0 && !currency) {
      return "Select a currency when Cost of Delay is provided.";
    }
    const s = sanitizeInputs(inputs);
    if (s.userBusinessValue != null && s.userBusinessValue < 0) {
      return "Value to users and the business must be zero or greater.";
    }
    if (s.timePressureValue != null && s.timePressureValue < 0) {
      return "Time pressure must be zero or greater.";
    }
    if (s.riskOpportunityValue != null && s.riskOpportunityValue < 0) {
      return "Risk or opportunity value must be zero or greater.";
    }
    if (s.oneTimeWaitingCost != null && s.oneTimeWaitingCost < 0) {
      return "One-time cost of waiting must be zero or greater.";
    }
    if (s.delayPeriods != null && s.delayPeriods < 0) {
      return "Delay length must be zero or greater.";
    }
    return "";
  }

  return {
    sanitizeInputs,
    compute,
    hasMeaningfulInputs,
    validationMessage,
    formatPlainNumber,
    buildHowToUse
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = CostOfDelay;
}
