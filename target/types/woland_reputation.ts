/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/woland_reputation.json`.
 */
export type WolandReputation = {
  "address": "42PrQGNH4pCqyGwxrLMXnfkDzz5CTCFx71y2HjuHK9Vg",
  "metadata": {
    "name": "wolandReputation",
    "version": "0.1.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "initializeReputation",
      "discriminator": [
        150,
        240,
        109,
        53,
        147,
        42,
        152,
        162
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "reputation",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  112,
                  117,
                  116,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "recordCompletion",
      "discriminator": [
        209,
        113,
        91,
        75,
        66,
        137,
        244,
        157
      ],
      "accounts": [
        {
          "name": "escrowProgram",
          "signer": true
        },
        {
          "name": "reputation",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  112,
                  117,
                  116,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "reputation.user",
                "account": "reputationAccount"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "escrowId",
          "type": "u64"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "isBuyer",
          "type": "bool"
        }
      ]
    },
    {
      "name": "recordDispute",
      "discriminator": [
        190,
        94,
        198,
        130,
        215,
        36,
        43,
        143
      ],
      "accounts": [
        {
          "name": "escrowProgram",
          "signer": true
        },
        {
          "name": "reputation",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  112,
                  117,
                  116,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "reputation.user",
                "account": "reputationAccount"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "escrowId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "submitRating",
      "discriminator": [
        238,
        207,
        253,
        243,
        170,
        69,
        73,
        199
      ],
      "accounts": [
        {
          "name": "rater",
          "writable": true,
          "signer": true
        },
        {
          "name": "targetReputation",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  112,
                  117,
                  116,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "target_reputation.user",
                "account": "reputationAccount"
              }
            ]
          }
        },
        {
          "name": "rating",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  97,
                  116,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "rater"
              },
              {
                "kind": "arg",
                "path": "escrowId"
              }
            ]
          }
        },
        {
          "name": "escrowAccount"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "escrowId",
          "type": "u64"
        },
        {
          "name": "score",
          "type": "u8"
        },
        {
          "name": "commentHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "ratingRecord",
      "discriminator": [
        54,
        124,
        2,
        199,
        106,
        108,
        236,
        58
      ]
    },
    {
      "name": "reputationAccount",
      "discriminator": [
        19,
        185,
        177,
        157,
        34,
        87,
        67,
        233
      ]
    }
  ],
  "events": [
    {
      "name": "completionRecorded",
      "discriminator": [
        250,
        75,
        79,
        194,
        127,
        57,
        128,
        174
      ]
    },
    {
      "name": "disputeRecorded",
      "discriminator": [
        139,
        17,
        122,
        22,
        203,
        18,
        108,
        84
      ]
    },
    {
      "name": "ratingSubmitted",
      "discriminator": [
        129,
        135,
        238,
        21,
        26,
        150,
        24,
        219
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "overflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6001,
      "name": "invalidScore",
      "msg": "Rating score must be between 1 and 5"
    },
    {
      "code": 6002,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6003,
      "name": "cannotSelfRate",
      "msg": "Cannot rate yourself"
    },
    {
      "code": 6004,
      "name": "notParticipant",
      "msg": "Not a participant of this escrow"
    },
    {
      "code": 6005,
      "name": "escrowNotReleased",
      "msg": "Escrow must be in Released state to rate"
    },
    {
      "code": 6006,
      "name": "invalidEscrow",
      "msg": "Invalid escrow account data"
    }
  ],
  "types": [
    {
      "name": "completionRecorded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "escrowId",
            "type": "u64"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "isBuyer",
            "type": "bool"
          },
          {
            "name": "ordersCompleted",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "disputeRecorded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "escrowId",
            "type": "u64"
          },
          {
            "name": "ordersDisputed",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "ratingRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "escrowId",
            "type": "u64"
          },
          {
            "name": "rater",
            "type": "pubkey"
          },
          {
            "name": "target",
            "type": "pubkey"
          },
          {
            "name": "score",
            "type": "u8"
          },
          {
            "name": "commentHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "ratingSubmitted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "escrowId",
            "type": "u64"
          },
          {
            "name": "rater",
            "type": "pubkey"
          },
          {
            "name": "target",
            "type": "pubkey"
          },
          {
            "name": "score",
            "type": "u8"
          },
          {
            "name": "avgRatingX100",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "reputationAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "ordersCompleted",
            "type": "u64"
          },
          {
            "name": "ordersDisputed",
            "type": "u64"
          },
          {
            "name": "totalEarned",
            "type": "u64"
          },
          {
            "name": "totalSpent",
            "type": "u64"
          },
          {
            "name": "ratingSum",
            "type": "u64"
          },
          {
            "name": "ratingCount",
            "type": "u64"
          },
          {
            "name": "badgeFlags",
            "type": "u8"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
