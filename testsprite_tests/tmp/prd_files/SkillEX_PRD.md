# SkillEX Product Specification Document (PRD)

## 1. Product Overview

**Vision:** To democratize access to education, professional services, and resources by creating a seamless, community-driven bartering and micro-economy platform.

**Problem Statement:** Individuals (especially students and young professionals) often lack the financial capital to access premium skills, tutoring, or resources. Traditional marketplaces strictly require fiat currency, creating a barrier to entry for those who have valuable skills or resources to offer but limited cash.

**Solution:** **SkillEX** is a skill and resource trading platform that allows users to exchange services, books, and resources using either a proprietary internal "Credit" system or direct 1-to-1 Bartering. By introducing an escrow system and dynamic smart matching, SkillEX ensures safe, equitable, and efficient exchanges without relying on traditional fiat currency.

---

## 2. Target Users

*   **Students:** High school, university, or self-taught learners looking to exchange textbooks, peer tutoring, or access educational resources without spending cash.
*   **General Users:** Freelancers, hobbyists, and professionals looking to trade their specialized skills (e.g., graphic design, coding, language practice) for other services or internal credits.

---

## 3. User Personas

**Persona 1: Alex the Student**
*   **Background:** 20-year-old college student majoring in Computer Science.
*   **Needs:** Needs a calculus tutor and a specific physics textbook.
*   **Offerings:** Can offer beginner coding lessons in Python.
*   **Goal:** Use the barter system to trade his coding skills for calculus tutoring.

**Persona 2: Sarah the Professional**
*   **Background:** 28-year-old freelance Graphic Designer.
*   **Needs:** Needs help translating her portfolio into Spanish.
*   **Offerings:** Logo and branding design.
*   **Goal:** Complete small design gigs to earn platform credits, then use those credits to "buy" translation services.

---

## 4. User Flows

### Core Flow: Signup → Dashboard → Marketplace → Trade → Message

1.  **Onboarding:** User arrives at the landing page, clicks Signup, completes the multi-step registration (defining user type, location, languages), verifies their email, and logs in.
2.  **Dashboard:** User lands on the Dashboard, sees their credit balance, active trades, and posts a "Requirement" (e.g., "Need Spanish translation").
3.  **Discovery (Marketplace):** The platform's smart matching engine suggests listings based on the user's requirement. The user browses the Marketplace, using location and type filters to find a suitable listing.
4.  **Initiating Trade:** The user finds a listing, clicks "Buy (CRD)" or "Barter", and initiates a trade request.
5.  **Execution (Messaging):** A chat is automatically created. Both users discuss the terms via real-time messaging.
6.  **Completion:** The service is delivered. The users click "Complete Trade". Escrow is released, and the buyer is prompted to leave a review.

---

## 5. Feature Specifications

### 5.1 Authentication
*   **Description:** Secure, stateful authentication system managing user sessions and onboarding.
*   **Inputs/Outputs:** Email, Password, Name, User Type, Institution (if student), Location (auto-detected via geolocation API or manually entered), Languages. Outputs a secure JWT session.
*   **UI Behavior:** Multi-step wizard layout for signup. Password fields include a toggle-visibility eye icon. Validation errors appear inline.
*   **Validations:** Email must be valid format and unique. Password must be >= 6 characters. Location must contain Country, State, City.
*   **Edge Cases:** User abandons signup halfway; email verification link expires; network disconnect during form submission.

### 5.2 Marketplace
*   **Description:** The primary discovery engine for listings, featuring robust filtering and smart recommendations.
*   **Inputs/Outputs:** Inputs: Search queries, Location filters (Country/State/City/Pincode), Listing Type filters, Language filters. Outputs: Filtered array of listing cards.
*   **UI Behavior:** Card-based grid UI. Filter state is managed locally without full page reloads (SPA routing). "Location" acts as a proximity filter against the logged-in user's profile.
*   **Validations:** Users cannot see their own listings. Unavailable or deleted listings are hidden. Blocked users' listings are strictly filtered out.
*   **Edge Cases:** Empty states when filters are too restrictive.

### 5.3 Create Listing
*   **Description:** Allows users to offer skills, resources, books, or services to the marketplace.
*   **Inputs/Outputs:** Title, Description, Type (Skill/Resource/Book/Service), Experience Level (Beginner/Intermediate/Expert), Credit Price.
*   **UI Behavior:** Form with dynamic price validation. Price input border changes color (green/amber/red) based on proximity to caps.
*   **Validations:** Price cannot exceed dynamic caps based on experience (e.g., Beginner max 100, Expert max 500). Title and description cannot be empty.
*   **Edge Cases:** User tries to bypass HTML limits via API request (backend validation required).

### 5.4 Trades System & Escrow
*   **Description:** Secure transaction engine facilitating both Credit and Barter exchanges.
*   **Inputs/Outputs:** Trade initiation payload (buyer, seller, listing ID, trade type). Outputs a Trade Document.
*   **UI Behavior:** Trades appear in a dedicated "Trades" dashboard. Buttons allow users to "Accept", "Reject", "Complete", or "Cancel".
*   **Validations & Business Rules (Escrow):**
    *   *Credit Trades:* When accepted, credits are deducted from Buyer and held in Escrow. When Buyer marks "Complete", Escrow is released to Seller. If canceled, Escrow refunds Buyer.
    *   *Barter Trades:* Both parties must explicitly mark the trade as "Complete" for the status to change to completed.
*   **Edge Cases:** Buyer does not have enough credits; Seller deletes listing while trade is pending; concurrent trade requests for a single-stock item (Book/Resource).

### 5.5 Messaging
*   **Description:** Real-time peer-to-peer communication.
*   **Inputs/Outputs:** Text input. Outputs message documents in a chat sub-collection.
*   **UI Behavior:** Chat interface with scroll-to-bottom. Timestamps formatted relatively (e.g., "2 mins ago"). Read receipts via "Seen" status.
*   **Validations:** Cannot message blocked users.
*   **Edge Cases:** Rapid-fire message spam; offline message queuing.

### 5.6 Notifications
*   **Description:** Alerts users to important platform events.
*   **Inputs/Outputs:** Triggered by cloud functions or client-side transactions (new message, trade update, review).
*   **UI Behavior:** Notification bell icon with unread badge counter. Dropdown panel showing scrollable list of notifications.
*   **Validations:** Users only receive notifications belonging to their UID.
*   **Edge Cases:** User has app open in multiple tabs (sync read states).

### 5.7 Reviews & Ratings
*   **Description:** Trust and safety mechanism.
*   **Inputs/Outputs:** Rating (1-5 integers), Text review.
*   **UI Behavior:** Buyer is prompted via modal to leave a review upon trade completion. Seller profiles display aggregate average rating and recent reviews.
*   **Validations:** Only the Buyer can review the Seller. Can only be submitted once per completed trade.
*   **Edge Cases:** Trade is completed but buyer closes the modal (must be able to access review form later from Trades page).

### 5.8 Credits System
*   **Description:** The internal currency tracking ledger.
*   **Inputs/Outputs:** Credit additions (signup bonus, earned from trades), Credit deductions (spent on trades).
*   **UI Behavior:** Navbar displays current balance. Clicking balance opens a transaction history dropdown panel.
*   **Validations:** All credit mutations must happen via atomic Firestore transactions to prevent race conditions. Balance cannot drop below 0.

### 5.9 Smart Matching
*   **Description:** Recommends listings to users based on their declared needs.
*   **Inputs/Outputs:** Reads user's active "Requirements". Matches against Marketplace listings' titles, tags, and languages.
*   **UI Behavior:** Dedicated horizontal scroll row at the top of the Marketplace. Only visible if matches exist.
*   **Validations:** Excludes user's own listings and blocked users.

### 5.10 Report & Block System
*   **Description:** Community moderation tools.
*   **Inputs/Outputs:** Target User ID, Target Listing ID, Reason.
*   **UI Behavior:** "Flag" and "Block" icons on marketplace cards and user profiles. Prompts for optional reason.
*   **Validations:** A blocked user's listings immediately disappear from the blocker's marketplace. Direct messaging is disabled.
*   **Edge Cases:** User blocks someone they are currently in an active trade with.

### 5.11 Admin System
*   **Description:** Platform oversight dashboard.
*   **Inputs/Outputs:** Accessible only by accounts flagged as `isAdmin` (e.g., `admin@gmail.com`).
*   **UI Behavior:** Dedicated `/admin` route. Three tabs: Overview (Stats), Reports (Moderation queue), Users (Directory).
*   **Validations:** Admin can "Resolve" or "Dismiss" reports. Admin can apply a "Banned" flag to users.
*   **Edge Cases:** Banned users attempting to log in (should be blocked at auth level or heavily restricted).

---

## 6. System Architecture

*   **Frontend Paradigm:** Single Page Application (SPA) utilizing vanilla JavaScript or a lightweight framework. Hash-based or History API routing to prevent `Cannot GET` errors on reload.
*   **Backend Paradigm:** Serverless architecture utilizing Firebase Services.
*   **Database:** Cloud Firestore (NoSQL Document Database).
*   **Authentication:** Firebase Authentication (Email/Password).
*   **Real-time System:** Firestore `onSnapshot` listeners used for chat, notifications, and live trade status updates. State management leverages a central `state.js` store with pub/sub architecture (`updateState` / `subscribe`).

---

## 7. Database Design (Firestore)

| Collection | Document ID | Key Fields | Relationships |
| :--- | :--- | :--- | :--- |
| **users** | `uid` (Auth ID) | `email`, `name`, `userType`, `credits`, `location` (map), `languages` (array), `blockedUsers` (array), `banned` (bool) | 1:1 with Auth, 1:N with listings/trades. |
| **listings** | Auto-ID | `uid` (owner), `title`, `description`, `listingType`, `creditPrice`, `unavailable` (bool), `createdAt` | Belongs to `users`. |
| **trades** | Auto-ID | `buyerId`, `sellerId`, `listingId`, `tradeType` (credit/barter), `status` (pending, in_progress, completed, canceled), `escrowAmount` | References `users` and `listings`. |
| **chats** | `uid1_uid2` | `participants` (array), `lastMessage`, `lastMessageAt`, `tradeId` | 1:1 with a specific user pairing. |
| **messages** (sub) | Auto-ID | `senderId`, `text`, `timestamp`, `read` | Belongs to `chats`. |
| **creditTransactions**| Auto-ID | `uid`, `amount` (+/-), `reason`, `relatedId` (tradeId), `createdAt` | Immutable ledger. Belongs to `users`. |
| **reviews** | Auto-ID | `tradeId`, `reviewerId`, `targetId`, `rating`, `reviewText`, `createdAt` | 1:1 with `trades`. |
| **requirements** | Auto-ID | `uid`, `text`, `listingType`, `createdAt` | Belongs to `users`. |
| **notifications** | Auto-ID | `userId`, `type`, `message`, `read` (bool), `relatedId`, `createdAt` | Belongs to `users`. |
| **reports** | Auto-ID | `type` (user/listing), `reporterId`, `targetId`, `reason`, `status` (open/resolved/dismissed), `createdAt` | References `users` or `listings`. |

---

## 8. Business Logic Rules

*   **Escrow Handling:** Credits are transferred via `runTransaction`. 
    1. Buyer initiates -> Balance checked -> Deducted -> Trade created.
    2. Trade Complete -> Credits added to Seller -> Transaction logged.
    3. Trade Canceled -> Credits refunded to Buyer -> Transaction logged.
*   **Price Caps:** Enforced at listing creation. Beginner (Max 100 CRD), Intermediate (Max 300 CRD), Expert (Max 1000 CRD).
*   **Inventory Rules:** If a `book` or `resource` is involved in a trade that reaches `completed` status, the listing's `unavailable` flag is set to `true` (or the listing is archived/deleted) to prevent double-spending. `skills` and `services` remain active for infinite trades.
*   **Review Restrictions:** Reviews can only be submitted if `trade.status === 'completed'` and the user submitting is the `buyerId`.

---

## 9. Non-Functional Requirements

*   **Performance:** The SPA must load the initial shell in under 1.5 seconds. Firestore queries must utilize `limit()` and pagination cursor logic (`startAfter`) to prevent massive payload downloads.
*   **Scalability:** The NoSQL schema is denormalized where necessary (e.g., storing basic user info on the listing document) to reduce read operations.
*   **Security:** Firestore Security Rules must securely restrict access. Users can only write to their own profile. Escrow transactions must be validated server-side or via strict atomic security rules.
*   **Responsiveness:** The UI must be fully mobile-responsive, utilizing CSS Grid/Flexbox and a mobile-first design approach.

---

## 10. Edge Cases

*   **Network Failure:** If the internet disconnects during a trade initiation, the atomic `runTransaction` ensures that credits are not deducted unless the trade document is successfully created.
*   **Duplicate Actions:** Buttons (like "Accept Trade") must be disabled immediately upon click to prevent double-firing and duplicate transactions.
*   **Invalid Trades:** Users cannot initiate a trade on a listing that is marked `unavailable`.
*   **Blocked Users:** If User A blocks User B, existing chats should be disabled (input hidden/disabled), and pending trades should ideally be flagged or canceled to prevent forced interaction.

---

## 11. Future Enhancements

*   **AI Matching:** Implement vector embeddings for requirement text and listing descriptions to provide semantic search matches rather than basic keyword matching.
*   **Advanced Analytics:** Implement charting libraries in the Admin dashboard to track credit velocity and user retention over time.
*   **Dispute Resolution:** Allow users to flag a trade as "Disputed" rather than just canceled, freezing the escrow and escalating to Admin moderation.
*   **Geolocation Radius:** Upgrade location filtering from string matching (City to City) to actual geospatial queries (within 25km radius) using Geohashes.
