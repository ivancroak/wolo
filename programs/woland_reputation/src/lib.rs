use anchor_lang::prelude::*;

declare_id!("42PrQGNH4pCqyGwxrLMXnfkDzz5CTCFx71y2HjuHK9Vg");

// Compile-time constant: raw bytes of "9yJBgVvpGvvQRWbPNzDAgv9snP8bvoXXS7A8U28nzNd9"
const ESCROW_PROGRAM_ID: Pubkey = Pubkey::new_from_array([133, 73, 115, 110, 138, 133, 97, 2, 46, 62, 109, 59, 234, 135, 171, 71, 134, 71, 101, 73, 139, 252, 237, 168, 57, 176, 42, 250, 130, 239, 228, 252]);

// First 8 bytes of sha256("account:EscrowAccount") — Anchor discriminator
const ESCROW_ACCOUNT_DISCRIMINATOR: [u8; 8] = [36, 69, 48, 18, 128, 225, 125, 135];
const ESCROW_PHASE_RELEASED: u8 = 5;

#[program]
pub mod woland_reputation {
    use super::*;

    pub fn initialize_rep_config(ctx: Context<InitializeRepConfig>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.bump = ctx.bumps.config;
        Ok(())
    }

    pub fn update_rep_config(
        ctx: Context<UpdateRepConfig>,
        new_authority: Option<Pubkey>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        if let Some(authority) = new_authority {
            require!(authority != Pubkey::default(), WolandRepError::InvalidAddress);
            config.authority = authority;
        }
        Ok(())
    }

    pub fn initialize_reputation(ctx: Context<InitializeReputation>) -> Result<()> {
        let rep = &mut ctx.accounts.reputation;
        rep.user = ctx.accounts.user.key();
        rep.orders_completed = 0;
        rep.orders_disputed = 0;
        rep.total_earned = 0;
        rep.total_spent = 0;
        rep.rating_sum = 0;
        rep.rating_count = 0;
        rep.badge_flags = 0;
        rep.created_at = Clock::get()?.unix_timestamp;
        rep.bump = ctx.bumps.reputation;
        Ok(())
    }

    pub fn record_completion(
        ctx: Context<RecordCompletion>,
        escrow_id: u64,
        amount: u64,
        is_buyer: bool,
    ) -> Result<()> {
        let rep = &mut ctx.accounts.reputation;
        rep.orders_completed = rep.orders_completed.checked_add(1)
            .ok_or(WolandRepError::Overflow)?;

        if is_buyer {
            rep.total_spent = rep.total_spent.checked_add(amount)
                .ok_or(WolandRepError::Overflow)?;
        } else {
            rep.total_earned = rep.total_earned.checked_add(amount)
                .ok_or(WolandRepError::Overflow)?;
        }

        update_badges(rep);

        emit!(CompletionRecorded {
            user: rep.user,
            escrow_id,
            amount,
            is_buyer,
            orders_completed: rep.orders_completed,
        });

        Ok(())
    }

    pub fn record_dispute(ctx: Context<RecordDispute>, escrow_id: u64) -> Result<()> {
        let rep = &mut ctx.accounts.reputation;
        rep.orders_disputed = rep.orders_disputed.checked_add(1)
            .ok_or(WolandRepError::Overflow)?;

        update_badges(rep);

        emit!(DisputeRecorded {
            user: rep.user,
            escrow_id,
            orders_disputed: rep.orders_disputed,
        });

        Ok(())
    }

    pub fn submit_rating(
        ctx: Context<SubmitRating>,
        escrow_id: u64,
        score: u8,
        comment_hash: [u8; 32],
    ) -> Result<()> {
        require!(score >= 1 && score <= 5, WolandRepError::InvalidScore);
        require!(
            ctx.accounts.rater.key() != ctx.accounts.target_reputation.user,
            WolandRepError::CannotSelfRate
        );

        let escrow_info = &ctx.accounts.escrow_account;
        let escrow_data = escrow_info.try_borrow_data()?;

        // Minimum length: disc(8) + id(8) + depositor(32) + receiver(32) + amount(8) + released(8) + phase(1)
        require!(escrow_data.len() > 96, WolandRepError::InvalidEscrow);

        // C-6 fix: validate Anchor discriminator to prevent account type confusion
        let disc: [u8; 8] = escrow_data[0..8].try_into().unwrap();
        require!(disc == ESCROW_ACCOUNT_DISCRIMINATOR, WolandRepError::InvalidEscrow);

        // C-5 fix: validate escrow_id matches the on-chain account's id field
        let onchain_id = u64::from_le_bytes(escrow_data[8..16].try_into().unwrap());
        require!(onchain_id == escrow_id, WolandRepError::EscrowIdMismatch);

        let depositor_bytes: [u8; 32] = escrow_data[16..48].try_into().unwrap();
        let receiver_bytes: [u8; 32] = escrow_data[48..80].try_into().unwrap();
        let depositor = Pubkey::new_from_array(depositor_bytes);
        let receiver = Pubkey::new_from_array(receiver_bytes);

        // Also verify the escrow PDA matches expected seeds
        let (expected_pda, _) = Pubkey::find_program_address(
            &[b"escrow", depositor_bytes.as_ref(), &escrow_id.to_le_bytes()],
            &ESCROW_PROGRAM_ID,
        );
        require!(escrow_info.key() == expected_pda, WolandRepError::InvalidEscrow);

        let rater_key = ctx.accounts.rater.key();
        require!(
            rater_key == depositor || rater_key == receiver,
            WolandRepError::NotParticipant
        );

        let target_key = ctx.accounts.target_reputation.user;
        require!(
            target_key == depositor || target_key == receiver,
            WolandRepError::NotParticipant
        );

        let phase = escrow_data[96]; // disc(8) + id(8) + depositor(32) + receiver(32) + amount(8) + released(8)
        require!(phase == ESCROW_PHASE_RELEASED, WolandRepError::EscrowNotReleased);

        let rating = &mut ctx.accounts.rating;
        rating.escrow_id = escrow_id;
        rating.rater = ctx.accounts.rater.key();
        rating.target = ctx.accounts.target_reputation.user;
        rating.score = score;
        rating.comment_hash = comment_hash;
        rating.created_at = Clock::get()?.unix_timestamp;
        rating.bump = ctx.bumps.rating;

        let rep = &mut ctx.accounts.target_reputation;
        rep.rating_sum = rep.rating_sum.checked_add(score as u64)
            .ok_or(WolandRepError::Overflow)?;
        rep.rating_count = rep.rating_count.checked_add(1)
            .ok_or(WolandRepError::Overflow)?;

        update_badges(rep);

        emit!(RatingSubmitted {
            escrow_id,
            rater: ctx.accounts.rater.key(),
            target: rep.user,
            score,
            avg_rating_x100: if rep.rating_count > 0 {
                rep.rating_sum.checked_mul(100)
                    .and_then(|v| v.checked_div(rep.rating_count))
                    .unwrap_or(0) as u16
            } else {
                0
            },
        });

        Ok(())
    }
}

fn update_badges(rep: &mut ReputationAccount) {
    let mut flags: u8 = 0;

    if rep.orders_completed >= 1 {
        flags |= 1 << 0;
    }
    if rep.orders_completed >= 5 {
        flags |= 1 << 1;
    }
    if rep.orders_completed >= 25 {
        flags |= 1 << 2;
    }
    if rep.orders_completed >= 10 && rep.rating_count > 0 {
        if let Some(avg_x10) = rep.rating_sum.checked_mul(10).and_then(|v| v.checked_div(rep.rating_count)) {
            if avg_x10 >= 45 {
                flags |= 1 << 3;
            }
        }
    }
    if rep.rating_count >= 3 {
        if let Some(avg_x10) = rep.rating_sum.checked_mul(10).and_then(|v| v.checked_div(rep.rating_count)) {
            if avg_x10 >= 45 {
                flags |= 1 << 4;
            }
        }
    }
    if rep.total_earned >= 100_000_000 {
        flags |= 1 << 5;
    }
    if rep.orders_completed >= 10 && rep.orders_disputed == 0 {
        flags |= 1 << 6;
    }

    rep.badge_flags = flags;
}

// --- Accounts ---

#[derive(Accounts)]
pub struct InitializeRepConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + ReputationConfig::INIT_SPACE,
        seeds = [b"rep_config"],
        bump,
    )]
    pub config: Account<'info, ReputationConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateRepConfig<'info> {
    #[account(constraint = authority.key() == config.authority @ WolandRepError::Unauthorized)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"rep_config"],
        bump = config.bump,
    )]
    pub config: Account<'info, ReputationConfig>,
}

#[derive(Accounts)]
pub struct InitializeReputation<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        payer = user,
        space = 8 + ReputationAccount::INIT_SPACE,
        seeds = [b"reputation", user.key().as_ref()],
        bump,
    )]
    pub reputation: Account<'info, ReputationAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RecordCompletion<'info> {
    #[account(
        constraint = authority.key() == config.authority @ WolandRepError::Unauthorized
    )]
    pub authority: Signer<'info>,
    #[account(
        seeds = [b"rep_config"],
        bump = config.bump,
    )]
    pub config: Account<'info, ReputationConfig>,
    #[account(
        mut,
        seeds = [b"reputation", reputation.user.as_ref()],
        bump = reputation.bump,
    )]
    pub reputation: Account<'info, ReputationAccount>,
}

#[derive(Accounts)]
pub struct RecordDispute<'info> {
    #[account(
        constraint = authority.key() == config.authority @ WolandRepError::Unauthorized
    )]
    pub authority: Signer<'info>,
    #[account(
        seeds = [b"rep_config"],
        bump = config.bump,
    )]
    pub config: Account<'info, ReputationConfig>,
    #[account(
        mut,
        seeds = [b"reputation", reputation.user.as_ref()],
        bump = reputation.bump,
    )]
    pub reputation: Account<'info, ReputationAccount>,
}

#[derive(Accounts)]
#[instruction(escrow_id: u64)]
pub struct SubmitRating<'info> {
    #[account(mut)]
    pub rater: Signer<'info>,
    #[account(
        mut,
        seeds = [b"reputation", target_reputation.user.as_ref()],
        bump = target_reputation.bump,
    )]
    pub target_reputation: Account<'info, ReputationAccount>,
    #[account(
        init,
        payer = rater,
        space = 8 + RatingRecord::INIT_SPACE,
        seeds = [b"rating", rater.key().as_ref(), &escrow_id.to_le_bytes()],
        bump,
    )]
    pub rating: Account<'info, RatingRecord>,
    /// CHECK: Escrow account - must be owned by the escrow program, discriminator + PDA validated in instruction
    #[account(
        constraint = escrow_account.owner == &ESCROW_PROGRAM_ID @ WolandRepError::InvalidEscrow
    )]
    pub escrow_account: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

// --- State ---

#[account]
#[derive(InitSpace)]
pub struct ReputationConfig {
    pub authority: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ReputationAccount {
    pub user: Pubkey,
    pub orders_completed: u64,
    pub orders_disputed: u64,
    pub total_earned: u64,
    pub total_spent: u64,
    pub rating_sum: u64,
    pub rating_count: u64,
    pub badge_flags: u8,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct RatingRecord {
    pub escrow_id: u64,
    pub rater: Pubkey,
    pub target: Pubkey,
    pub score: u8,
    pub comment_hash: [u8; 32],
    pub created_at: i64,
    pub bump: u8,
}

// --- Events ---

#[event]
pub struct CompletionRecorded {
    pub user: Pubkey,
    pub escrow_id: u64,
    pub amount: u64,
    pub is_buyer: bool,
    pub orders_completed: u64,
}

#[event]
pub struct DisputeRecorded {
    pub user: Pubkey,
    pub escrow_id: u64,
    pub orders_disputed: u64,
}

#[event]
pub struct RatingSubmitted {
    pub escrow_id: u64,
    pub rater: Pubkey,
    pub target: Pubkey,
    pub score: u8,
    pub avg_rating_x100: u16,
}

// --- Errors ---

#[error_code]
pub enum WolandRepError {
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Rating score must be between 1 and 5")]
    InvalidScore,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Cannot rate yourself")]
    CannotSelfRate,
    #[msg("Not a participant of this escrow")]
    NotParticipant,
    #[msg("Escrow must be in Released state to rate")]
    EscrowNotReleased,
    #[msg("Invalid escrow account data")]
    InvalidEscrow,
    #[msg("Escrow ID does not match on-chain account")]
    EscrowIdMismatch,
    #[msg("Cannot set to zero address")]
    InvalidAddress,
}

#[cfg(test)]
mod tests {
    use super::*;

    // Helper: build a zeroed ReputationAccount for use in unit tests.
    // The #[account] macro does not add extra fields in the struct layout;
    // all public fields are available directly.
    fn blank_rep() -> ReputationAccount {
        ReputationAccount {
            user: Pubkey::default(),
            orders_completed: 0,
            orders_disputed: 0,
            total_earned: 0,
            total_spent: 0,
            rating_sum: 0,
            rating_count: 0,
            badge_flags: 0,
            created_at: 0,
            bump: 0,
        }
    }

    // -----------------------------------------------------------------------
    // update_badges tests
    // -----------------------------------------------------------------------

    /// Completely fresh account: no badges at all.
    #[test]
    fn test_badges_fresh_account_no_flags() {
        let mut rep = blank_rep();
        update_badges(&mut rep);
        assert_eq!(rep.badge_flags, 0b0000_0000);
    }

    /// First order completed sets bit 0 only.
    #[test]
    fn test_badges_first_completion() {
        let mut rep = blank_rep();
        rep.orders_completed = 1;
        update_badges(&mut rep);
        // bit 0 set
        assert!(rep.badge_flags & (1 << 0) != 0);
        // bit 1 NOT set (need 5)
        assert!(rep.badge_flags & (1 << 1) == 0);
    }

    /// 5 completions → bits 0 and 1 set.
    #[test]
    fn test_badges_five_completions() {
        let mut rep = blank_rep();
        rep.orders_completed = 5;
        update_badges(&mut rep);
        assert!(rep.badge_flags & (1 << 0) != 0, "bit0 (>=1)");
        assert!(rep.badge_flags & (1 << 1) != 0, "bit1 (>=5)");
        assert!(rep.badge_flags & (1 << 2) == 0, "bit2 not yet (needs 25)");
    }

    /// 25+ completions → bits 0, 1, and 2 set.
    #[test]
    fn test_badges_twenty_five_completions() {
        let mut rep = blank_rep();
        rep.orders_completed = 25;
        update_badges(&mut rep);
        assert!(rep.badge_flags & (1 << 0) != 0, "bit0");
        assert!(rep.badge_flags & (1 << 1) != 0, "bit1");
        assert!(rep.badge_flags & (1 << 2) != 0, "bit2");
    }

    /// Bit 3: requires orders_completed >= 10 AND avg*10 >= 45.
    /// 10 orders, rating_sum=45, rating_count=10 → avg*10 = 45 → qualifies.
    #[test]
    fn test_badges_bit3_high_avg_ten_orders() {
        let mut rep = blank_rep();
        rep.orders_completed = 10;
        rep.rating_sum = 45;
        rep.rating_count = 10;
        update_badges(&mut rep);
        assert!(rep.badge_flags & (1 << 3) != 0, "bit3 (>=10 orders + avg>=4.5)");
    }

    /// Bit 3 NOT set when avg is too low (avg*10 = 44 < 45).
    #[test]
    fn test_badges_bit3_low_avg_not_set() {
        let mut rep = blank_rep();
        rep.orders_completed = 10;
        rep.rating_sum = 44; // avg = 4.4, avg*10 = 44 < 45
        rep.rating_count = 10;
        update_badges(&mut rep);
        assert!(rep.badge_flags & (1 << 3) == 0, "bit3 should not be set with avg 4.4");
    }

    /// Bit 4: rating_count >= 3 AND avg*10 >= 45.
    /// 3 ratings, all 5 → avg=5 → avg*10=50 >= 45 → bit4 set.
    #[test]
    fn test_badges_bit4_high_avg_three_ratings() {
        let mut rep = blank_rep();
        rep.orders_completed = 2; // below 5 so bit1 not set; only bit0 and bit4
        rep.rating_sum = 15; // 3 * 5
        rep.rating_count = 3;
        update_badges(&mut rep);
        assert!(rep.badge_flags & (1 << 4) != 0, "bit4 (>=3 ratings + avg>=4.5)");
        assert!(rep.badge_flags & (1 << 3) == 0, "bit3 needs 10 orders");
    }

    /// Bit 5: total_earned >= 100_000_000.
    #[test]
    fn test_badges_bit5_high_earner() {
        let mut rep = blank_rep();
        rep.total_earned = 100_000_000;
        update_badges(&mut rep);
        assert!(rep.badge_flags & (1 << 5) != 0, "bit5 (high earner)");
    }

    /// Bit 5 NOT set just below threshold.
    #[test]
    fn test_badges_bit5_just_below_threshold() {
        let mut rep = blank_rep();
        rep.total_earned = 99_999_999;
        update_badges(&mut rep);
        assert!(rep.badge_flags & (1 << 5) == 0, "bit5 should not be set below threshold");
    }

    /// Bit 6: orders_completed >= 10 AND orders_disputed == 0.
    #[test]
    fn test_badges_bit6_clean_record() {
        let mut rep = blank_rep();
        rep.orders_completed = 10;
        rep.orders_disputed = 0;
        update_badges(&mut rep);
        assert!(rep.badge_flags & (1 << 6) != 0, "bit6 (clean record)");
    }

    /// Bit 6 NOT set if any disputes exist.
    #[test]
    fn test_badges_bit6_with_dispute_not_set() {
        let mut rep = blank_rep();
        rep.orders_completed = 20;
        rep.orders_disputed = 1;
        update_badges(&mut rep);
        assert!(rep.badge_flags & (1 << 6) == 0, "bit6 should not be set with disputes");
    }

    /// rating_count == 0 must not panic (guarded by checked_div in the function).
    /// With 0 ratings the avg path is skipped entirely → bits 3 and 4 never fire.
    #[test]
    fn test_badges_zero_rating_count_no_panic() {
        let mut rep = blank_rep();
        rep.orders_completed = 50;
        rep.rating_sum = 1_000; // large sum, but count = 0
        rep.rating_count = 0;
        update_badges(&mut rep); // must not panic
        // bit3 requires rating_count > 0 → not set
        assert!(rep.badge_flags & (1 << 3) == 0, "bit3 needs rating_count > 0");
        // bit4 requires rating_count >= 3 → not set
        assert!(rep.badge_flags & (1 << 4) == 0, "bit4 needs rating_count >= 3");
        // bits 0, 1, 2 should be set (50 completions)
        assert!(rep.badge_flags & (1 << 0) != 0);
        assert!(rep.badge_flags & (1 << 1) != 0);
        assert!(rep.badge_flags & (1 << 2) != 0);
    }
}
