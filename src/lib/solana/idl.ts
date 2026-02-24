export const ESCROW_PROGRAM_ID = process.env.NEXT_PUBLIC_ESCROW_PROGRAM_ID || "9yJBgVvpGvvQRWbPNzDAgv9snP8bvoXXS7A8U28nzNd9";
export const REPUTATION_PROGRAM_ID = process.env.NEXT_PUBLIC_REPUTATION_PROGRAM_ID || "42PrQGNH4pCqyGwxrLMXnfkDzz5CTCFx71y2HjuHK9Vg";

export const ESCROW_IDL = {
  version: "0.1.0",
  name: "woland_escrow",
  instructions: [
    {
      name: "initializeConfig",
      accounts: [
        { name: "authority", isMut: true, isSigner: true },
        { name: "config", isMut: true, isSigner: false },
        { name: "feeVault", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [{ name: "feeBps", type: "u16" }],
    },
    {
      name: "updateConfig",
      accounts: [
        { name: "authority", isMut: false, isSigner: true },
        { name: "config", isMut: true, isSigner: false },
      ],
      args: [
        { name: "newArbiter", type: { option: "publicKey" } },
        { name: "newFeeBps", type: { option: "u16" } },
        { name: "newAuthority", type: { option: "publicKey" } },
        { name: "newFeeVault", type: { option: "publicKey" } },
      ],
    },
    {
      name: "initializeEscrow",
      accounts: [
        { name: "depositor", isMut: true, isSigner: true },
        { name: "receiver", isMut: false, isSigner: false },
        { name: "mint", isMut: false, isSigner: false },
        { name: "escrow", isMut: true, isSigner: false },
        { name: "vault", isMut: true, isSigner: false },
        { name: "config", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "rent", isMut: false, isSigner: false },
      ],
      args: [
        { name: "escrowId", type: "u64" },
        { name: "amount", type: "u64" },
        { name: "expiresAt", type: "i64" },
      ],
    },
    {
      name: "fundEscrow",
      accounts: [
        { name: "depositor", isMut: true, isSigner: true },
        { name: "escrow", isMut: true, isSigner: false },
        { name: "vault", isMut: true, isSigner: false },
        { name: "depositorToken", isMut: true, isSigner: false },
        { name: "config", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [],
    },
    {
      name: "addMilestone",
      accounts: [
        { name: "authority", isMut: false, isSigner: true },
        { name: "escrow", isMut: true, isSigner: false },
      ],
      args: [
        { name: "titleHash", type: { array: ["u8", 32] } },
        { name: "amount", type: "u64" },
        { name: "deadlineOffset", type: "i64" },
      ],
    },
    {
      name: "advancePhase",
      accounts: [
        { name: "authority", isMut: false, isSigner: true },
        { name: "escrow", isMut: true, isSigner: false },
      ],
      args: [{ name: "newPhase", type: "u8" }],
    },
    {
      name: "submitMilestone",
      accounts: [
        { name: "authority", isMut: false, isSigner: true },
        { name: "escrow", isMut: true, isSigner: false },
      ],
      args: [{ name: "milestoneIdx", type: "u8" }],
    },
    {
      name: "rejectMilestone",
      accounts: [
        { name: "authority", isMut: false, isSigner: true },
        { name: "escrow", isMut: true, isSigner: false },
      ],
      args: [{ name: "milestoneIdx", type: "u8" }],
    },
    {
      name: "releaseFunds",
      accounts: [
        { name: "depositor", isMut: true, isSigner: true },
        { name: "escrow", isMut: true, isSigner: false },
        { name: "vault", isMut: true, isSigner: false },
        { name: "receiverToken", isMut: true, isSigner: false },
        { name: "feeVault", isMut: true, isSigner: false },
        { name: "config", isMut: false, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [],
    },
    {
      name: "releaseMilestone",
      accounts: [
        { name: "depositor", isMut: true, isSigner: true },
        { name: "escrow", isMut: true, isSigner: false },
        { name: "vault", isMut: true, isSigner: false },
        { name: "receiverToken", isMut: true, isSigner: false },
        { name: "feeVault", isMut: true, isSigner: false },
        { name: "config", isMut: false, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [{ name: "milestoneIdx", type: "u8" }],
    },
    {
      name: "refund",
      accounts: [
        { name: "authority", isMut: true, isSigner: true },
        { name: "escrow", isMut: true, isSigner: false },
        { name: "vault", isMut: true, isSigner: false },
        { name: "depositorToken", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [],
    },
    {
      name: "arbiterResolve",
      accounts: [
        { name: "arbiter", isMut: false, isSigner: true },
        { name: "escrow", isMut: true, isSigner: false },
        { name: "vault", isMut: true, isSigner: false },
        { name: "depositorToken", isMut: true, isSigner: false },
        { name: "receiverToken", isMut: true, isSigner: false },
        { name: "feeVault", isMut: true, isSigner: false },
        { name: "config", isMut: false, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [{ name: "depositorShareBps", type: "u16" }],
    },
    {
      name: "closeEscrow",
      accounts: [
        { name: "depositor", isMut: true, isSigner: true },
        { name: "escrow", isMut: true, isSigner: false },
        { name: "vault", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "PlatformConfig",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "publicKey" },
          { name: "arbiter", type: "publicKey" },
          { name: "feeBps", type: "u16" },
          { name: "feeVault", type: "publicKey" },
          { name: "totalEscrows", type: "u64" },
          { name: "totalVolume", type: "u64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "EscrowAccount",
      type: {
        kind: "struct",
        fields: [
          { name: "id", type: "u64" },
          { name: "depositor", type: "publicKey" },
          { name: "receiver", type: "publicKey" },
          { name: "mint", type: "publicKey" },
          { name: "amount", type: "u64" },
          { name: "released", type: "u64" },
          { name: "phase", type: { defined: "EscrowPhase" } },
          { name: "expiresAt", type: "i64" },
          { name: "createdAt", type: "i64" },
          { name: "disputeOpenedAt", type: "i64" },
          { name: "feeBps", type: "u16" },
          { name: "milestoneCount", type: "u8" },
          { name: "milestones", type: { array: [{ defined: "MilestoneData" }, 10] } },
          { name: "bump", type: "u8" },
          { name: "vaultBump", type: "u8" },
        ],
      },
    },
  ],
  types: [
    {
      name: "EscrowPhase",
      type: {
        kind: "enum",
        variants: [
          { name: "AwaitingDeposit" },
          { name: "Funded" },
          { name: "InProgress" },
          { name: "UnderReview" },
          { name: "MilestoneCheck" },
          { name: "Released" },
          { name: "Refunded" },
          { name: "Disputed" },
        ],
      },
    },
    {
      name: "MilestoneData",
      type: {
        kind: "struct",
        fields: [
          { name: "titleHash", type: { array: ["u8", 32] } },
          { name: "amount", type: "u64" },
          { name: "deadline", type: "i64" },
          { name: "status", type: { defined: "MilestoneStatus" } },
        ],
      },
    },
    {
      name: "MilestoneStatus",
      type: {
        kind: "enum",
        variants: [
          { name: "Pending" },
          { name: "Submitted" },
          { name: "Approved" },
          { name: "Rejected" },
          { name: "Expired" },
        ],
      },
    },
  ],
  events: [
    {
      name: "EscrowCreated",
      fields: [
        { name: "escrowId", type: "u64", index: false },
        { name: "depositor", type: "publicKey", index: false },
        { name: "receiver", type: "publicKey", index: false },
        { name: "amount", type: "u64", index: false },
        { name: "expiresAt", type: "i64", index: false },
      ],
    },
    {
      name: "EscrowFunded",
      fields: [
        { name: "escrowId", type: "u64", index: false },
        { name: "amount", type: "u64", index: false },
      ],
    },
    {
      name: "PhaseAdvanced",
      fields: [
        { name: "escrowId", type: "u64", index: false },
        { name: "oldPhase", type: "u8", index: false },
        { name: "newPhase", type: "u8", index: false },
        { name: "by", type: "publicKey", index: false },
      ],
    },
    {
      name: "MilestoneAdded",
      fields: [
        { name: "escrowId", type: "u64", index: false },
        { name: "milestoneIdx", type: "u8", index: false },
        { name: "amount", type: "u64", index: false },
        { name: "deadline", type: "i64", index: false },
      ],
    },
    {
      name: "MilestoneSubmitted",
      fields: [
        { name: "escrowId", type: "u64", index: false },
        { name: "milestoneIdx", type: "u8", index: false },
      ],
    },
    {
      name: "MilestoneRejected",
      fields: [
        { name: "escrowId", type: "u64", index: false },
        { name: "milestoneIdx", type: "u8", index: false },
      ],
    },
    {
      name: "MilestoneReleased",
      fields: [
        { name: "escrowId", type: "u64", index: false },
        { name: "milestoneIdx", type: "u8", index: false },
        { name: "amount", type: "u64", index: false },
        { name: "fee", type: "u64", index: false },
        { name: "totalReleased", type: "u64", index: false },
      ],
    },
    {
      name: "FundsReleased",
      fields: [
        { name: "escrowId", type: "u64", index: false },
        { name: "receiver", type: "publicKey", index: false },
        { name: "netAmount", type: "u64", index: false },
        { name: "fee", type: "u64", index: false },
      ],
    },
    {
      name: "EscrowRefunded",
      fields: [
        { name: "escrowId", type: "u64", index: false },
        { name: "depositor", type: "publicKey", index: false },
        { name: "amount", type: "u64", index: false },
      ],
    },
    {
      name: "DisputeResolved",
      fields: [
        { name: "escrowId", type: "u64", index: false },
        { name: "arbiter", type: "publicKey", index: false },
        { name: "depositorAmount", type: "u64", index: false },
        { name: "receiverAmount", type: "u64", index: false },
        { name: "fee", type: "u64", index: false },
      ],
    },
    {
      name: "EscrowClosed",
      fields: [
        { name: "escrowId", type: "u64", index: false },
      ],
    },
  ],
  errors: [
    { code: 6000, name: "InvalidPhase", msg: "Invalid escrow phase for this operation" },
    { code: 6001, name: "InvalidPhaseTransition", msg: "Invalid phase transition" },
    { code: 6002, name: "Unauthorized", msg: "Unauthorized" },
    { code: 6003, name: "NothingToRelease", msg: "Nothing to release" },
    { code: 6004, name: "InsufficientFunds", msg: "Insufficient funds in escrow" },
    { code: 6005, name: "RefundNotAllowed", msg: "Refund not allowed in current state" },
    { code: 6006, name: "ZeroAmount", msg: "Amount must be greater than zero" },
    { code: 6007, name: "ExpiryInPast", msg: "Expiry timestamp must be in the future" },
    { code: 6008, name: "Overflow", msg: "Arithmetic overflow" },
    { code: 6009, name: "FeeTooHigh", msg: "Platform fee exceeds maximum" },
    { code: 6010, name: "InvalidFeeVault", msg: "Invalid fee vault" },
    { code: 6011, name: "TooManyMilestones", msg: "Too many milestones" },
    { code: 6012, name: "MilestoneExceedsEscrow", msg: "Milestone total exceeds escrow amount" },
    { code: 6013, name: "InvalidMilestone", msg: "Invalid milestone index" },
    { code: 6014, name: "MilestoneNotSubmitted", msg: "Milestone must be in submitted status" },
    { code: 6015, name: "MilestoneNotSubmittable", msg: "Milestone cannot be submitted in current status" },
    { code: 6016, name: "MilestoneExpired", msg: "Milestone deadline has passed" },
    { code: 6017, name: "EscrowNotSettled", msg: "Escrow must be released or refunded to close" },
    { code: 6018, name: "InvalidShareBps", msg: "Invalid share basis points" },
    { code: 6019, name: "MintMismatch", msg: "Token mint does not match escrow mint" },
    { code: 6020, name: "InvalidReceiver", msg: "Invalid receiver address" },
  ],
} as const;

export const REPUTATION_IDL = {
  version: "0.1.0",
  name: "woland_reputation",
  instructions: [
    {
      name: "initializeRepConfig",
      accounts: [
        { name: "authority", isMut: true, isSigner: true },
        { name: "config", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [],
    },
    {
      name: "updateRepConfig",
      accounts: [
        { name: "authority", isMut: false, isSigner: true },
        { name: "config", isMut: true, isSigner: false },
      ],
      args: [{ name: "newAuthority", type: { option: "publicKey" } }],
    },
    {
      name: "initializeReputation",
      accounts: [
        { name: "user", isMut: true, isSigner: true },
        { name: "reputation", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [],
    },
    {
      name: "recordCompletion",
      accounts: [
        { name: "authority", isMut: false, isSigner: true },
        { name: "config", isMut: false, isSigner: false },
        { name: "reputation", isMut: true, isSigner: false },
      ],
      args: [
        { name: "escrowId", type: "u64" },
        { name: "amount", type: "u64" },
        { name: "isBuyer", type: "bool" },
      ],
    },
    {
      name: "recordDispute",
      accounts: [
        { name: "authority", isMut: false, isSigner: true },
        { name: "config", isMut: false, isSigner: false },
        { name: "reputation", isMut: true, isSigner: false },
      ],
      args: [{ name: "escrowId", type: "u64" }],
    },
    {
      name: "submitRating",
      accounts: [
        { name: "rater", isMut: true, isSigner: true },
        { name: "targetReputation", isMut: true, isSigner: false },
        { name: "rating", isMut: true, isSigner: false },
        { name: "escrowAccount", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "escrowId", type: "u64" },
        { name: "score", type: "u8" },
        { name: "commentHash", type: { array: ["u8", 32] } },
      ],
    },
  ],
  accounts: [
    {
      name: "ReputationConfig",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "publicKey" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "ReputationAccount",
      type: {
        kind: "struct",
        fields: [
          { name: "user", type: "publicKey" },
          { name: "ordersCompleted", type: "u64" },
          { name: "ordersDisputed", type: "u64" },
          { name: "totalEarned", type: "u64" },
          { name: "totalSpent", type: "u64" },
          { name: "ratingSum", type: "u64" },
          { name: "ratingCount", type: "u64" },
          { name: "badgeFlags", type: "u8" },
          { name: "createdAt", type: "i64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "RatingRecord",
      type: {
        kind: "struct",
        fields: [
          { name: "escrowId", type: "u64" },
          { name: "rater", type: "publicKey" },
          { name: "target", type: "publicKey" },
          { name: "score", type: "u8" },
          { name: "commentHash", type: { array: ["u8", 32] } },
          { name: "createdAt", type: "i64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
  ],
  events: [
    {
      name: "CompletionRecorded",
      fields: [
        { name: "user", type: "publicKey", index: false },
        { name: "escrowId", type: "u64", index: false },
        { name: "amount", type: "u64", index: false },
        { name: "isBuyer", type: "bool", index: false },
        { name: "ordersCompleted", type: "u64", index: false },
      ],
    },
    {
      name: "DisputeRecorded",
      fields: [
        { name: "user", type: "publicKey", index: false },
        { name: "escrowId", type: "u64", index: false },
        { name: "ordersDisputed", type: "u64", index: false },
      ],
    },
    {
      name: "RatingSubmitted",
      fields: [
        { name: "escrowId", type: "u64", index: false },
        { name: "rater", type: "publicKey", index: false },
        { name: "target", type: "publicKey", index: false },
        { name: "score", type: "u8", index: false },
        { name: "avgRatingX100", type: "u16", index: false },
      ],
    },
  ],
  errors: [
    { code: 6000, name: "Overflow", msg: "Arithmetic overflow" },
    { code: 6001, name: "InvalidScore", msg: "Rating score must be between 1 and 5" },
    { code: 6002, name: "Unauthorized", msg: "Unauthorized" },
    { code: 6003, name: "CannotSelfRate", msg: "Cannot rate yourself" },
    { code: 6004, name: "NotParticipant", msg: "Not a participant of this escrow" },
    { code: 6005, name: "EscrowNotReleased", msg: "Escrow must be in Released state to rate" },
    { code: 6006, name: "InvalidEscrow", msg: "Invalid escrow account data" },
  ],
} as const;
