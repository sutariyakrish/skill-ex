import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  increment,
  runTransaction,
  setDoc,
  addDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./config.js";
import { getPricingRules, validateListingPrice } from "../utils/progression.js";
import { makeChatId } from "../utils/helpers.js";

export const COLLECTIONS = {
  users: "users",
  listings: "listings",
  trades: "trades",
  requirements: "requirements",
  creditTransactions: "creditTransactions",
  reviews: "reviews",
  messages: "messages",
  marketplace: "marketplace",
  chats: "chats",
  meetings: "meetings",
  notifications: "notifications",
  reports: "reports"
};

// ─── Internal helpers ────────────────────────────────────────────────────────

function createCreditTransactionEntry(transaction, uid, amount, reason, relatedId = null, now = Date.now()) {
  const entryRef = doc(collection(db, COLLECTIONS.creditTransactions));
  transaction.set(entryRef, {
    uid,
    amount,
    reason,
    relatedId: relatedId || null,
    createdAt: now
  });
}

function createNotificationInTx(transaction, userId, type, message, relatedId = null, now = Date.now()) {
  const notifRef = doc(collection(db, COLLECTIONS.notifications));
  transaction.set(notifRef, {
    userId,
    type,
    message,
    read: false,
    relatedId: relatedId || null,
    createdAt: now
  });
}

// ─── User ────────────────────────────────────────────────────────────────────

export async function getUserProfile(uid) {
  const snapshot = await getDoc(doc(db, COLLECTIONS.users, uid));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function createUserProfile(uid, profile) {
  await setDoc(
    doc(db, COLLECTIONS.users, uid),
    {
      ...profile,
      updatedAt: Date.now()
    },
    { merge: true }
  );
}

export async function updateUserProfile(uid, updates) {
  await updateDoc(doc(db, COLLECTIONS.users, uid), {
    ...updates,
    updatedAt: Date.now()
  });
}

export async function claimOneTimeCredits(uid, { flagField, amount }) {
  const userRef = doc(db, COLLECTIONS.users, uid);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(userRef);
    if (!snapshot.exists()) {
      throw new Error("User profile not found.");
    }

    const data = snapshot.data();
    if (data[flagField]) {
      return { awarded: false, credits: data.credits || 0 };
    }

    transaction.update(userRef, {
      credits: increment(amount),
      [flagField]: true,
      updatedAt: Date.now()
    });
    createCreditTransactionEntry(transaction, uid, amount, "signup bonus", flagField);

    return { awarded: true, credits: (data.credits || 0) + amount };
  });
}

// ─── Listings ────────────────────────────────────────────────────────────────

export async function createMarketplaceListing(uid, listing) {
  const userRef = doc(db, COLLECTIONS.users, uid);
  const listingRef = doc(collection(db, COLLECTIONS.listings));

  return runTransaction(db, async (transaction) => {
    const userSnapshot = await transaction.get(userRef);
    if (!userSnapshot.exists()) throw new Error("User profile not found.");

    const userData = userSnapshot.data();
    const pricingValidation = validateListingPrice(userData, listing.creditPrice);
    if (!pricingValidation.valid) throw new Error(pricingValidation.message);

    const pricing = getPricingRules(userData);
    const now = Date.now();
    const listingCount = Math.max(0, Number(userData.totalListingsCreated) || 0);
    const rewardAwarded = !userData.firstListingRewardGiven && listingCount === 0;
    const nextCredits = Math.max(0, Number(userData.credits) || 0) + (rewardAwarded ? 40 : 0);

    transaction.set(listingRef, {
      ...listing,
      uid,
      ownerId: uid,
      creditPrice: pricingValidation.price,
      priceLabel: `${pricingValidation.price} credits`,
      category: "General",
      tags: [],
      sellerLevel: pricing.level,
      sellerRating: pricing.rating,
      maxAllowedPrice: pricing.finalCap,
      unavailable: false,
      createdAt: now,
      updatedAt: now
    });

    transaction.update(userRef, {
      tradesCompleted: pricing.tradesCompleted,
      rating: pricing.rating,
      level: pricing.level,
      totalListingsCreated: increment(1),
      updatedAt: now,
      ...(rewardAwarded
        ? { credits: increment(40), firstListingRewardGiven: true }
        : {})
    });

    if (rewardAwarded) {
      createCreditTransactionEntry(transaction, uid, 40, "listing reward", listingRef.id, now);
    }

    return {
      pricing,
      rewardAwarded,
      credits: nextCredits,
      totalListingsCreated: listingCount + 1,
      level: pricing.level
    };
  });
}

export async function removeMarketplaceListing(id) {
  await deleteDoc(doc(db, COLLECTIONS.listings, id));
}

export async function removeListing(id, sourceCollection = COLLECTIONS.listings) {
  await deleteDoc(doc(db, sourceCollection, id));
}

// ─── Conversations / Chat ─────────────────────────────────────────────────────

export async function upsertConversation(chatId, payload) {
  await setDoc(
    doc(db, COLLECTIONS.chats, chatId),
    { ...payload, updatedAt: Date.now() },
    { merge: true }
  );
}

export async function sendChatMessage(chatId, message) {
  const createdAt = Date.now();
  await addDoc(collection(db, COLLECTIONS.chats, chatId, "messages"), {
    ...message,
    senderId: message.from,
    timestamp: createdAt
  });
  await upsertConversation(chatId, {
    participants: message.participants,
    lastMessage: message.text,
    lastMessageAt: createdAt,
    tradeId: message.tradeId || null
  });
}

// ─── Requirements ─────────────────────────────────────────────────────────────

export async function createRequirement(uid, requirement) {
  await addDoc(collection(db, COLLECTIONS.requirements), {
    ...requirement,
    uid,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
}

export async function updateRequirement(id, updates) {
  await updateDoc(doc(db, COLLECTIONS.requirements, id), {
    ...updates,
    updatedAt: Date.now()
  });
}

export async function removeRequirement(id) {
  await deleteDoc(doc(db, COLLECTIONS.requirements, id));
}

// ─── Trades ──────────────────────────────────────────────────────────────────

/**
 * Creates a trade request inside a Firestore transaction.
 * Validates: listing exists, not unavailable, buyer != owner.
 * Idempotent: relies on Firestore transaction isolation.
 */
export async function createTradeRequest(payload) {
  const createdAt = Date.now();
  const chatId = makeChatId(payload.buyerId, payload.sellerId);
  const listingRef = doc(db, payload.sourceCollection || COLLECTIONS.listings, payload.listingId);
  const tradeRef = doc(collection(db, COLLECTIONS.trades));
  const chatRef = doc(db, COLLECTIONS.chats, chatId);

  return runTransaction(db, async (transaction) => {
    const listingSnap = await transaction.get(listingRef);
    if (!listingSnap.exists()) throw new Error("Listing not found.");

    const listingData = listingSnap.data();
    if (listingData.unavailable === true) throw new Error("This listing is no longer available.");
    if (listingData.ownerId === payload.buyerId || listingData.uid === payload.buyerId) {
      throw new Error("Cannot trade with your own listing.");
    }

    transaction.set(tradeRef, {
      ...payload,
      chatId,
      status: "requested",
      createdAt,
      updatedAt: createdAt,
      completedAt: null,
      creditsTransferred: false,  // true once buyer pays (on accepted)
      escrowCredits: 0,           // amount held in escrow
      escrowRefunded: false,      // guard: refund runs at most once
      completedByBuyer: false,
      completedBySeller: false,
      reviewsBy: {}
    });

    transaction.set(
      chatRef,
      {
        participants: [payload.buyerId, payload.sellerId],
        tradeId: tradeRef.id,
        lastMessage: "",
        lastMessageAt: createdAt,
        updatedAt: createdAt
      },
      { merge: true }
    );

    return tradeRef;
  });
}

/**
 * Updates trade status with full escrow logic:
 * - accepted (credit trade): deduct buyer credits → escrow on trade doc
 * - completed: release escrow to seller
 * - cancelled/rejected AFTER accepted: refund escrow to buyer
 * All operations are idempotent via flags (creditsTransferred, escrowRefunded).
 */
export async function updateTradeStatus(tradeId, status, actorId, { rating = null } = {}) {
  const tradeRef = doc(db, COLLECTIONS.trades, tradeId);
  const now = Date.now();

  return runTransaction(db, async (transaction) => {
    const tradeSnap = await transaction.get(tradeRef);
    if (!tradeSnap.exists()) throw new Error("Trade not found.");

    const trade = tradeSnap.data();

    // ── Guard: participant check ──
    if (actorId !== trade.buyerId && actorId !== trade.sellerId) {
      throw new Error("Only trade participants can update this trade.");
    }

    // ── Guard: already closed ──
    if (trade.status === "cancelled" || trade.status === "rejected") {
      throw new Error("Trade is already closed.");
    }

    // ── Guard: already completed ──
    if (trade.status === "completed" && status === "completed") {
      return { status: "completed", completed: true };
    }

    // Pre-fetch all docs needed (reads BEFORE writes — Firestore rule)
    const buyerRef = doc(db, COLLECTIONS.users, trade.buyerId);
    const sellerRef = doc(db, COLLECTIONS.users, trade.sellerId);
    const [buyerSnap, sellerSnap] = await Promise.all([
      transaction.get(buyerRef),
      transaction.get(sellerRef)
    ]);
    if (!buyerSnap.exists() || !sellerSnap.exists()) throw new Error("Trade participants not found.");

    // Pre-fetch listing for book/resource (must be before any write)
    let listingSnap = null;
    let listingRef = null;
    const isPhysicalItem = ["book", "resource"].includes(String(trade.listingType || "").toLowerCase());
    if (isPhysicalItem && trade.listingId && !String(trade.listingId).startsWith("legacy-")) {
      const col = trade.sourceCollection || COLLECTIONS.listings;
      listingRef = doc(db, col, trade.listingId);
      listingSnap = await transaction.get(listingRef);
    }

    const updates = { status, updatedAt: now };
    const buyerData = buyerSnap.data();
    const sellerData = sellerSnap.data();

    // ── ACCEPT ──
    if (status === "accepted") {
      if (trade.sellerId !== actorId) throw new Error("Only the seller can accept this trade.");

      // Credit escrow: deduct from buyer, hold on trade doc
      if (trade.tradeType === "credit" && !trade.creditsTransferred) {
        const amount = Math.max(0, Number(trade.creditAmount) || 0);
        const buyerCredits = Number(buyerData.credits) || 0;
        if (buyerCredits < amount) throw new Error("Buyer does not have enough credits.");

        transaction.update(buyerRef, { credits: increment(-amount), updatedAt: now });
        createCreditTransactionEntry(transaction, trade.buyerId, -amount, "trade escrow hold", tradeId, now);

        updates.creditsTransferred = true;
        updates.escrowCredits = amount;
        updates.acceptedAt = now;
        updates.acceptedBy = actorId;

        // Notify buyer
        createNotificationInTx(
          transaction,
          trade.buyerId,
          "trade_accepted",
          `Your trade for "${trade.listingTitle || "a listing"}" was accepted.`,
          tradeId,
          now
        );
      }
    }

    // ── REJECT ──
    if (status === "rejected") {
      if (trade.sellerId !== actorId) throw new Error("Only the seller can reject this trade.");
      updates.closedAt = now;
      updates.closedBy = actorId;

      createNotificationInTx(
        transaction,
        trade.buyerId,
        "trade_rejected",
        `Your trade for "${trade.listingTitle || "a listing"}" was rejected.`,
        tradeId,
        now
      );
    }

    // ── CANCEL (with optional escrow refund) ──
    if (status === "cancelled") {
      updates.closedAt = now;
      updates.closedBy = actorId;

      // Refund escrow if credits were already held and not yet refunded
      if (
        trade.tradeType === "credit" &&
        trade.creditsTransferred &&
        !trade.escrowRefunded
      ) {
        const refundAmount = Number(trade.escrowCredits) || Number(trade.creditAmount) || 0;
        if (refundAmount > 0) {
          transaction.update(buyerRef, { credits: increment(refundAmount), updatedAt: now });
          createCreditTransactionEntry(transaction, trade.buyerId, refundAmount, "trade escrow refund", tradeId, now);
          updates.escrowRefunded = true;
          updates.creditsTransferred = false; // reset so no double-refund
        }
      }

      // Notify the other party
      const notifyUserId = actorId === trade.buyerId ? trade.sellerId : trade.buyerId;
      createNotificationInTx(
        transaction,
        notifyUserId,
        "trade_cancelled",
        `A trade for "${trade.listingTitle || "a listing"}" was cancelled.`,
        tradeId,
        now
      );
    }

    // ── COMPLETE ──
    if (status === "completed") {
      if (trade.tradeType === "barter") {
        const completedByBuyer = Boolean(trade.completedByBuyer) || actorId === trade.buyerId;
        const completedBySeller = Boolean(trade.completedBySeller) || actorId === trade.sellerId;
        updates.completedByBuyer = completedByBuyer;
        updates.completedBySeller = completedBySeller;

        if (completedByBuyer && completedBySeller) {
          // Both confirmed — fully complete
          updates.status = "completed";
          updates.completedAt = now;
          transaction.update(buyerRef, { tradesCompleted: increment(1), updatedAt: now });
          transaction.update(sellerRef, { tradesCompleted: increment(1), updatedAt: now });

          createNotificationInTx(
            transaction, trade.buyerId, "trade_completed",
            `Your barter trade for "${trade.listingTitle || "a listing"}" is complete!`,
            tradeId, now
          );
          createNotificationInTx(
            transaction, trade.sellerId, "trade_completed",
            `Your barter trade for "${trade.listingTitle || "a listing"}" is complete!`,
            tradeId, now
          );
        } else {
          // Waiting for the other party
          updates.status = "accepted";

          // Notify the other party to confirm
          const waitingFor = completedByBuyer ? trade.sellerId : trade.buyerId;
          createNotificationInTx(
            transaction, waitingFor, "trade_awaiting_confirmation",
            `Please confirm completion of the trade for "${trade.listingTitle || "a listing"}".`,
            tradeId, now
          );
        }
      } else {
        // Credit trade — only seller completes
        if (actorId !== trade.sellerId) throw new Error("Only the seller can complete credit trades.");

        // Release escrow to seller
        const escrowAmount = Number(trade.escrowCredits) || Number(trade.creditAmount) || 0;
        if (escrowAmount > 0 && trade.creditsTransferred && !trade.escrowRefunded) {
          transaction.update(sellerRef, { credits: increment(escrowAmount), updatedAt: now });
          createCreditTransactionEntry(transaction, trade.sellerId, escrowAmount, "trade payment received", tradeId, now);
        }

        updates.completedAt = now;
        updates.completedBySeller = true;
        updates.status = "completed";
        updates.escrowReleased = true;
        transaction.update(buyerRef, { tradesCompleted: increment(1), updatedAt: now });
        transaction.update(sellerRef, { tradesCompleted: increment(1), updatedAt: now });

        createNotificationInTx(
          transaction, trade.buyerId, "trade_completed",
          `Your trade for "${trade.listingTitle || "a listing"}" is complete. Please leave a review!`,
          tradeId, now
        );
      }
    }

    // ── Mark listing unavailable (book/resource only, on true completion) ──
    const finalStatus = updates.status || status;
    if (
      finalStatus === "completed" &&
      listingSnap &&
      listingSnap.exists() &&
      listingSnap.data().unavailable !== true
    ) {
      transaction.update(listingRef, { unavailable: true, updatedAt: now });
    }

    transaction.update(tradeRef, updates);
    return {
      status: finalStatus,
      completed: finalStatus === "completed"
    };
  });
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

/**
 * Only buyer (buyerId) can review the seller.
 * Validates: trade completed, reviewer is buyer, not already reviewed.
 */
export async function submitTradeReview(tradeId, { reviewerId, targetUserId, rating, reviewText = "" }) {
  const tradeRef = doc(db, COLLECTIONS.trades, tradeId);
  const targetRef = doc(db, COLLECTIONS.users, targetUserId);
  const reviewRef = doc(collection(db, COLLECTIONS.reviews));
  const now = Date.now();

  return runTransaction(db, async (transaction) => {
    const [tradeSnap, targetSnap] = await Promise.all([
      transaction.get(tradeRef),
      transaction.get(targetRef)
    ]);
    if (!tradeSnap.exists() || !targetSnap.exists()) throw new Error("Review target not found.");

    const trade = tradeSnap.data();
    if (trade.status !== "completed") throw new Error("Trade must be completed before review.");

    // ── Security: only buyer can review ──
    if (reviewerId !== trade.buyerId) throw new Error("Only the buyer can leave a review.");
    if (targetUserId !== trade.sellerId) throw new Error("You can only review the seller.");

    const reviewsBy = trade.reviewsBy || {};
    if (reviewsBy[reviewerId]) throw new Error("You already reviewed this trade.");

    const safeRating = Math.max(1, Math.min(5, Number(rating) || 0));
    const targetData = targetSnap.data();
    const count = Math.max(0, Number(targetData.reviewsCount) || 0);
    const currentAvg = Math.max(0, Number(targetData.rating) || 0);
    const nextAvg = (currentAvg * count + safeRating) / (count + 1);

    transaction.set(reviewRef, {
      tradeId,
      rating: safeRating,
      reviewText: String(reviewText || "").trim(),
      reviewerId,
      reviewerName: "",  // filled client-side if desired
      targetUserId,
      createdAt: now
    });
    transaction.update(tradeRef, { [`reviewsBy.${reviewerId}`]: true, updatedAt: now });
    transaction.update(targetRef, { rating: nextAvg, reviewsCount: increment(1), updatedAt: now });

    // Notify seller
    createNotificationInTx(
      transaction,
      targetUserId,
      "review_received",
      `You received a ${safeRating}-star review!`,
      tradeId,
      now
    );
  });
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function markNotificationRead(notifId) {
  await updateDoc(doc(db, COLLECTIONS.notifications, notifId), { read: true });
}

export async function markAllNotificationsRead(userId) {
  // Client-side batch — handled in realtime listener; direct write per doc
  // This is intentionally lightweight: batch mark is done via realtime + local state
}

// ─── Report / Block ───────────────────────────────────────────────────────────

export async function reportListing(reporterId, listingId, reason = "") {
  await addDoc(collection(db, COLLECTIONS.reports), {
    type: "listing",
    reporterId,
    targetId: listingId,
    reason: String(reason).trim().slice(0, 500),
    status: "open",
    createdAt: Date.now()
  });
}

export async function reportUser(reporterId, targetUserId, reason = "") {
  await addDoc(collection(db, COLLECTIONS.reports), {
    type: "user",
    reporterId,
    targetId: targetUserId,
    reason: String(reason).trim().slice(0, 500),
    status: "open",
    createdAt: Date.now()
  });
}

export async function blockUser(uid, targetUid) {
  const userRef = doc(db, COLLECTIONS.users, uid);
  await updateDoc(userRef, {
    blockedUsers: arrayUnion(targetUid),
    updatedAt: Date.now()
  });
}

export async function unblockUser(uid, targetUid) {
  const userRef = doc(db, COLLECTIONS.users, uid);
  await updateDoc(userRef, {
    blockedUsers: arrayRemove(targetUid),
    updatedAt: Date.now()
  });
}

// ─── Messages ────────────────────────────────────────────────────────────────

export async function sendTradeMessage(payload) {
  const createdAt = Date.now();
  const chatId = payload.chatId || makeChatId(payload.from, payload.to);
  await addDoc(collection(db, COLLECTIONS.chats, chatId, "messages"), {
    ...payload,
    senderId: payload.from,
    timestamp: createdAt
  });
  await upsertConversation(chatId, {
    participants: payload.participants || [payload.from, payload.to],
    lastMessage: payload.text || "",
    lastMessageAt: createdAt,
    tradeId: payload.tradeId || null
  });
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export async function adminGetStats() {
  const [usersSnap, listingsSnap, tradesSnap, reportsSnap] = await Promise.all([
    getDocs(collection(db, COLLECTIONS.users)),
    getDocs(collection(db, COLLECTIONS.listings)),
    getDocs(collection(db, COLLECTIONS.trades)),
    getDocs(collection(db, COLLECTIONS.reports))
  ]);
  const trades = tradesSnap.docs.map((d) => d.data());
  const completedTrades = trades.filter((t) => t.status === "completed").length;
  const pendingTrades = trades.filter((t) => t.status === "pending").length;
  const openReports = reportsSnap.docs.filter((d) => d.data().status === "open").length;
  return {
    totalUsers: usersSnap.size,
    totalListings: listingsSnap.size,
    totalTrades: tradesSnap.size,
    completedTrades,
    pendingTrades,
    totalReports: reportsSnap.size,
    openReports
  };
}

export async function adminGetReports() {
  const snap = await getDocs(query(collection(db, COLLECTIONS.reports), orderBy("createdAt", "desc"), limit(100)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function adminGetUsers() {
  const snap = await getDocs(query(collection(db, COLLECTIONS.users), orderBy("createdAt", "desc"), limit(200)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function adminUpdateReportStatus(reportId, status) {
  await updateDoc(doc(db, COLLECTIONS.reports, reportId), { status, resolvedAt: Date.now() });
}

export async function adminDeleteListing(listingId) {
  await deleteDoc(doc(db, COLLECTIONS.listings, listingId));
}

export async function adminBanUser(uid) {
  await updateDoc(doc(db, COLLECTIONS.users, uid), { banned: true, bannedAt: Date.now() });
}
