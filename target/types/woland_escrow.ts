/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/woland_escrow.json`.
 */
export type WolandEscrow = {
  "address": "9yJBgVvpGvvQRWbPNzDAgv9snP8bvoXXS7A8U28nzNd9",
  "metadata": {
    "name": "wolandEscrow",
    "version": "0.1.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "addMilestone",
      "discriminator": [
        165,
        18,
        177,
        128,
        204,
        172,
        23,
        249
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "escrow.depositor",
                "account": "escrowAccount"
              },
              {
                "kind": "account",
                "path": "escrow.id",
                "account": "escrowAccount"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "titleHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "deadlineOffset",
          "type": "i64"
        }
      ]
    },
    {
      "name": "advancePhase",
      "discriminator": [
        91,
        6,
        51,
        226,
        144,
        243,
        74,
        113
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "escrow.depositor",
                "account": "escrowAccount"
              },
              {
                "kind": "account",
                "path": "escrow.id",
                "account": "escrowAccount"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newPhase",
          "type": "u8"
        }
      ]
    },
    {
      "name": "arbiterResolve",
      "discriminator": [
        72,
        74,
        145,
        98,
        97,
        32,
        107,
        5
      ],
      "accounts": [
        {
          "name": "arbiter",
          "signer": true
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "escrow.depositor",
                "account": "escrowAccount"
              },
              {
                "kind": "account",
                "path": "escrow.id",
                "account": "escrowAccount"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "escrow"
              }
            ]
          }
        },
        {
          "name": "depositorToken",
          "writable": true
        },
        {
          "name": "receiverToken",
          "writable": true
        },
        {
          "name": "feeVault",
          "writable": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "depositorShareBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "closeEscrow",
      "discriminator": [
        139,
        171,
        94,
        146,
        191,
        91,
        144,
        50
      ],
      "accounts": [
        {
          "name": "depositor",
          "writable": true,
          "signer": true
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "escrow.depositor",
                "account": "escrowAccount"
              },
              {
                "kind": "account",
                "path": "escrow.id",
                "account": "escrowAccount"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "escrow"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "fundEscrow",
      "discriminator": [
        155,
        18,
        218,
        141,
        182,
        213,
        69,
        201
      ],
      "accounts": [
        {
          "name": "depositor",
          "writable": true,
          "signer": true
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "escrow.depositor",
                "account": "escrowAccount"
              },
              {
                "kind": "account",
                "path": "escrow.id",
                "account": "escrowAccount"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "escrow"
              }
            ]
          }
        },
        {
          "name": "depositorToken",
          "writable": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "initializeConfig",
      "discriminator": [
        208,
        127,
        21,
        1,
        194,
        190,
        196,
        70
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "feeVault"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "feeBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "initializeEscrow",
      "discriminator": [
        243,
        160,
        77,
        153,
        11,
        92,
        48,
        209
      ],
      "accounts": [
        {
          "name": "depositor",
          "writable": true,
          "signer": true
        },
        {
          "name": "receiver"
        },
        {
          "name": "mint"
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "depositor"
              },
              {
                "kind": "arg",
                "path": "escrowId"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "escrow"
              }
            ]
          }
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
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
          "name": "expiresAt",
          "type": "i64"
        }
      ]
    },
    {
      "name": "refund",
      "discriminator": [
        2,
        96,
        183,
        251,
        63,
        208,
        46,
        46
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "escrow.depositor",
                "account": "escrowAccount"
              },
              {
                "kind": "account",
                "path": "escrow.id",
                "account": "escrowAccount"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "escrow"
              }
            ]
          }
        },
        {
          "name": "depositorToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "rejectMilestone",
      "discriminator": [
        243,
        48,
        66,
        165,
        237,
        41,
        116,
        249
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "escrow.depositor",
                "account": "escrowAccount"
              },
              {
                "kind": "account",
                "path": "escrow.id",
                "account": "escrowAccount"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "milestoneIdx",
          "type": "u8"
        }
      ]
    },
    {
      "name": "releaseFunds",
      "discriminator": [
        225,
        88,
        91,
        108,
        126,
        52,
        2,
        26
      ],
      "accounts": [
        {
          "name": "depositor",
          "writable": true,
          "signer": true
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "escrow.depositor",
                "account": "escrowAccount"
              },
              {
                "kind": "account",
                "path": "escrow.id",
                "account": "escrowAccount"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "escrow"
              }
            ]
          }
        },
        {
          "name": "receiverToken",
          "writable": true
        },
        {
          "name": "feeVault",
          "writable": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "releaseMilestone",
      "discriminator": [
        56,
        2,
        199,
        164,
        184,
        108,
        167,
        222
      ],
      "accounts": [
        {
          "name": "depositor",
          "writable": true,
          "signer": true
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "escrow.depositor",
                "account": "escrowAccount"
              },
              {
                "kind": "account",
                "path": "escrow.id",
                "account": "escrowAccount"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "escrow"
              }
            ]
          }
        },
        {
          "name": "receiverToken",
          "writable": true
        },
        {
          "name": "feeVault",
          "writable": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "milestoneIdx",
          "type": "u8"
        }
      ]
    },
    {
      "name": "submitMilestone",
      "discriminator": [
        35,
        96,
        220,
        215,
        102,
        83,
        139,
        52
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "escrow.depositor",
                "account": "escrowAccount"
              },
              {
                "kind": "account",
                "path": "escrow.id",
                "account": "escrowAccount"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "milestoneIdx",
          "type": "u8"
        }
      ]
    },
    {
      "name": "updateConfig",
      "discriminator": [
        29,
        158,
        252,
        191,
        10,
        83,
        219,
        99
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newArbiter",
          "type": {
            "option": "pubkey"
          }
        },
        {
          "name": "newFeeBps",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "newAuthority",
          "type": {
            "option": "pubkey"
          }
        },
        {
          "name": "newFeeVault",
          "type": {
            "option": "pubkey"
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "escrowAccount",
      "discriminator": [
        36,
        69,
        48,
        18,
        128,
        225,
        125,
        135
      ]
    },
    {
      "name": "platformConfig",
      "discriminator": [
        160,
        78,
        128,
        0,
        248,
        83,
        230,
        160
      ]
    }
  ],
  "events": [
    {
      "name": "disputeResolved",
      "discriminator": [
        121,
        64,
        249,
        153,
        139,
        128,
        236,
        187
      ]
    },
    {
      "name": "escrowClosed",
      "discriminator": [
        109,
        20,
        57,
        51,
        217,
        118,
        3,
        173
      ]
    },
    {
      "name": "escrowCreated",
      "discriminator": [
        70,
        127,
        105,
        102,
        92,
        97,
        7,
        173
      ]
    },
    {
      "name": "escrowFunded",
      "discriminator": [
        228,
        243,
        166,
        74,
        22,
        167,
        157,
        244
      ]
    },
    {
      "name": "escrowRefunded",
      "discriminator": [
        132,
        209,
        49,
        109,
        135,
        138,
        28,
        81
      ]
    },
    {
      "name": "fundsReleased",
      "discriminator": [
        178,
        119,
        252,
        230,
        131,
        104,
        210,
        210
      ]
    },
    {
      "name": "milestoneAdded",
      "discriminator": [
        25,
        65,
        182,
        178,
        253,
        180,
        118,
        77
      ]
    },
    {
      "name": "milestoneRejected",
      "discriminator": [
        194,
        242,
        80,
        147,
        56,
        228,
        195,
        245
      ]
    },
    {
      "name": "milestoneReleased",
      "discriminator": [
        49,
        225,
        91,
        223,
        34,
        165,
        109,
        181
      ]
    },
    {
      "name": "milestoneSubmitted",
      "discriminator": [
        242,
        19,
        75,
        99,
        12,
        28,
        19,
        33
      ]
    },
    {
      "name": "phaseAdvanced",
      "discriminator": [
        123,
        52,
        118,
        23,
        154,
        234,
        206,
        41
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidPhase",
      "msg": "Invalid escrow phase for this operation"
    },
    {
      "code": 6001,
      "name": "invalidPhaseTransition",
      "msg": "Invalid phase transition"
    },
    {
      "code": 6002,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6003,
      "name": "nothingToRelease",
      "msg": "Nothing to release"
    },
    {
      "code": 6004,
      "name": "insufficientFunds",
      "msg": "Insufficient funds in escrow"
    },
    {
      "code": 6005,
      "name": "refundNotAllowed",
      "msg": "Refund not allowed in current state"
    },
    {
      "code": 6006,
      "name": "zeroAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6007,
      "name": "expiryInPast",
      "msg": "Expiry timestamp must be in the future"
    },
    {
      "code": 6008,
      "name": "overflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6009,
      "name": "feeTooHigh",
      "msg": "Platform fee exceeds maximum"
    },
    {
      "code": 6010,
      "name": "invalidFeeVault",
      "msg": "Invalid fee vault"
    },
    {
      "code": 6011,
      "name": "tooManyMilestones",
      "msg": "Too many milestones"
    },
    {
      "code": 6012,
      "name": "milestoneExceedsEscrow",
      "msg": "Milestone total exceeds escrow amount"
    },
    {
      "code": 6013,
      "name": "invalidMilestone",
      "msg": "Invalid milestone index"
    },
    {
      "code": 6014,
      "name": "milestoneNotSubmitted",
      "msg": "Milestone must be in submitted status"
    },
    {
      "code": 6015,
      "name": "milestoneNotSubmittable",
      "msg": "Milestone cannot be submitted in current status"
    },
    {
      "code": 6016,
      "name": "milestoneExpired",
      "msg": "Milestone deadline has passed"
    },
    {
      "code": 6017,
      "name": "escrowNotSettled",
      "msg": "Escrow must be released or refunded to close"
    },
    {
      "code": 6018,
      "name": "invalidShareBps",
      "msg": "Invalid share basis points"
    },
    {
      "code": 6019,
      "name": "mintMismatch",
      "msg": "Token mint does not match escrow mint"
    },
    {
      "code": 6020,
      "name": "invalidReceiver",
      "msg": "Invalid receiver address"
    }
  ],
  "types": [
    {
      "name": "disputeResolved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "escrowId",
            "type": "u64"
          },
          {
            "name": "arbiter",
            "type": "pubkey"
          },
          {
            "name": "depositorAmount",
            "type": "u64"
          },
          {
            "name": "receiverAmount",
            "type": "u64"
          },
          {
            "name": "fee",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "escrowAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "depositor",
            "type": "pubkey"
          },
          {
            "name": "receiver",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "released",
            "type": "u64"
          },
          {
            "name": "phase",
            "type": {
              "defined": {
                "name": "escrowPhase"
              }
            }
          },
          {
            "name": "expiresAt",
            "type": "i64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "disputeOpenedAt",
            "type": "i64"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "milestoneCount",
            "type": "u8"
          },
          {
            "name": "milestones",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "milestoneData"
                  }
                },
                10
              ]
            }
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "escrowClosed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "escrowId",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "escrowCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "escrowId",
            "type": "u64"
          },
          {
            "name": "depositor",
            "type": "pubkey"
          },
          {
            "name": "receiver",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "expiresAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "escrowFunded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "escrowId",
            "type": "u64"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "escrowPhase",
      "repr": {
        "kind": "rust"
      },
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "awaitingDeposit"
          },
          {
            "name": "funded"
          },
          {
            "name": "inProgress"
          },
          {
            "name": "underReview"
          },
          {
            "name": "milestoneCheck"
          },
          {
            "name": "released"
          },
          {
            "name": "refunded"
          },
          {
            "name": "disputed"
          }
        ]
      }
    },
    {
      "name": "escrowRefunded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "escrowId",
            "type": "u64"
          },
          {
            "name": "depositor",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "fundsReleased",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "escrowId",
            "type": "u64"
          },
          {
            "name": "receiver",
            "type": "pubkey"
          },
          {
            "name": "netAmount",
            "type": "u64"
          },
          {
            "name": "fee",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "milestoneAdded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "escrowId",
            "type": "u64"
          },
          {
            "name": "milestoneIdx",
            "type": "u8"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "deadline",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "milestoneData",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "titleHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "deadline",
            "type": "i64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "milestoneStatus"
              }
            }
          }
        ]
      }
    },
    {
      "name": "milestoneRejected",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "escrowId",
            "type": "u64"
          },
          {
            "name": "milestoneIdx",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "milestoneReleased",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "escrowId",
            "type": "u64"
          },
          {
            "name": "milestoneIdx",
            "type": "u8"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "fee",
            "type": "u64"
          },
          {
            "name": "totalReleased",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "milestoneStatus",
      "repr": {
        "kind": "rust"
      },
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pending"
          },
          {
            "name": "submitted"
          },
          {
            "name": "approved"
          },
          {
            "name": "rejected"
          },
          {
            "name": "expired"
          }
        ]
      }
    },
    {
      "name": "milestoneSubmitted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "escrowId",
            "type": "u64"
          },
          {
            "name": "milestoneIdx",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "phaseAdvanced",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "escrowId",
            "type": "u64"
          },
          {
            "name": "oldPhase",
            "type": "u8"
          },
          {
            "name": "newPhase",
            "type": "u8"
          },
          {
            "name": "by",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "platformConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "arbiter",
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "feeVault",
            "type": "pubkey"
          },
          {
            "name": "totalEscrows",
            "type": "u64"
          },
          {
            "name": "totalVolume",
            "type": "u64"
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
