const LEVELS = {
  Beginner: {
    minTrades: 0,
    maxTrades: 5,
    baseCap: 50,
    minPrice: 5,
    badge: "🟢",
    accent: "#3ecf8e",
    nextLevel: "Intermediate",
    nextTradeTarget: 6
  },
  Intermediate: {
    minTrades: 6,
    maxTrades: 20,
    baseCap: 100,
    minPrice: 10,
    badge: "🔵",
    accent: "#57a6ff",
    nextLevel: "Expert",
    nextTradeTarget: 21
  },
  Expert: {
    minTrades: 21,
    maxTrades: Number.POSITIVE_INFINITY,
    baseCap: 200,
    minPrice: 20,
    badge: "🟣",
    accent: "#8d6bff",
    nextLevel: "",
    nextTradeTarget: null
  }
};

function roundToNearestFive(value) {
  return Math.round(value / 5) * 5;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function getUserTradeStats(user = {}) {
  const tradesCompleted = Math.max(0, Number(user.tradesCompleted) || 0);
  const storedRating = Number(user.rating);
  const rating = Number.isFinite(storedRating) ? clamp(storedRating, 0, 5) : 0;

  let level = "Beginner";
  if (tradesCompleted >= LEVELS.Expert.minTrades) {
    level = "Expert";
  } else if (tradesCompleted >= LEVELS.Intermediate.minTrades) {
    level = "Intermediate";
  }

  const config = LEVELS[level];
  return {
    tradesCompleted,
    rating,
    level,
    badge: config.badge,
    accent: config.accent
  };
}

export function getRatingMultiplier(level, rating) {
  if (level === "Beginner") {
    return 1;
  }

  const effectiveRating = rating > 0 ? rating : 3;
  if (effectiveRating >= 4.5) {
    return 1.2;
  }
  if (effectiveRating < 3) {
    return 0.7;
  }
  return 1;
}

export function getPricingRules(user = {}) {
  const stats = getUserTradeStats(user);
  const config = LEVELS[stats.level];
  const multiplier = getRatingMultiplier(stats.level, stats.rating);
  const finalCap = Math.max(config.minPrice, Math.floor(config.baseCap * multiplier));
  const suggestedMin = Math.max(config.minPrice, roundToNearestFive(finalCap * 0.45));
  const suggestedMax = Math.max(suggestedMin, roundToNearestFive(finalCap * 0.8));

  return {
    ...stats,
    baseCap: config.baseCap,
    minPrice: config.minPrice,
    ratingMultiplier: multiplier,
    finalCap,
    suggestedMin,
    suggestedMax,
    nextLevel: config.nextLevel,
    nextTradeTarget: config.nextTradeTarget
  };
}

export function validateListingPrice(user, rawPrice) {
  const rules = getPricingRules(user);
  const price = Number(rawPrice);

  if (!Number.isFinite(price)) {
    return {
      valid: false,
      price: 0,
      rules,
      message: "Enter a valid credit price."
    };
  }

  if (price < rules.minPrice) {
    return {
      valid: false,
      price,
      rules,
      message: `Minimum price for ${rules.level} is ${rules.minPrice} credits.`
    };
  }

  if (price > rules.finalCap) {
    return {
      valid: false,
      price,
      rules,
      message: `Your current cap is ${rules.finalCap} credits.`
    };
  }

  return {
    valid: true,
    price,
    rules,
    message: ""
  };
}

export function getLevelProgress(user = {}) {
  const rules = getPricingRules(user);
  if (!rules.nextTradeTarget) {
    return {
      ...rules,
      progressPercent: 100,
      tradesRemaining: 0,
      progressLabel: "You have unlocked the highest level."
    };
  }

  const currentFloor = LEVELS[rules.level].minTrades;
  const span = rules.nextTradeTarget - currentFloor;
  const completedInLevel = rules.tradesCompleted - currentFloor;
  const progressPercent = clamp((completedInLevel / span) * 100, 0, 100);
  const tradesRemaining = Math.max(0, rules.nextTradeTarget - rules.tradesCompleted);

  return {
    ...rules,
    progressPercent,
    tradesRemaining,
    progressLabel: `${tradesRemaining} ${tradesRemaining === 1 ? "trade" : "trades"} left to reach ${rules.nextLevel}`
  };
}

export function getDashboardInsights(user = {}, listingsCreated = 0) {
  const progress = getLevelProgress(user);
  const insights = [];

  if (progress.tradesRemaining > 0) {
    insights.push(`Complete ${progress.tradesRemaining} more ${progress.tradesRemaining === 1 ? "trade" : "trades"} to unlock ${progress.nextLevel} pricing.`);
  }

  if (progress.level !== "Beginner" && progress.rating > 0 && progress.rating < 4.5) {
    insights.push("Improve your rating to 4.5+ to increase your earning cap by 20%.");
  }

  if (progress.level !== "Beginner" && progress.rating > 0 && progress.rating < 3) {
    insights.push("Your current rating reduces your maximum price by 30% right now.");
  }

  if (!user.firstListingRewardGiven && listingsCreated === 0) {
    insights.push("Create your first listing to unlock a 40 credit reward.");
  }

  if (!insights.length) {
    insights.push("Your pricing profile is in great shape. Keep trading to maintain your edge.");
  }

  return insights.slice(0, 3);
}
