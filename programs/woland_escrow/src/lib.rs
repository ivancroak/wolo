use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Mint};

declare_id!("9yJBgVvpGvvQRWbPNzDAgv9snP8bvoXXS7A8U28nzNd9");

const MAX_MILESTONES: usize = 10;
const MAX_FEE_BPS: u16 = 1000; // 10% cap
const DISPUTE_WINDOW_SECONDS: i64 = 7 * 86400; // 7 days

#[program]
pub mod woland_escrow {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        fee_bps: u16,
    ) -> Result<()> {
        require!(fee_bps <= MAX_FEE_BPS, WolandError::FeeTooHigh);
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.arbiter = ctx.accounts.authority.key();
        config.fee_bps = fee_bps;
        config.fee_vault = ctx.accounts.fee_vault.key();
        config.total_escrows = 0;
        config.total_volume = 0;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        new_arbiter: Option<Pubkey>,
        new_fee_bps: Option<u16>,
        new_authority: Option<Pubkey>,
        new_fee_vault: Option<Pubkey>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        if let Some(arbiter) = new_arbiter {
            config.arbiter = arbiter;
        }
        if let Some(fee_bps) = new_fee_bps {
            require!(fee_bps <= MAX_FEE_BPS, WolandError::FeeTooHigh);
            config.fee_bps = fee_bps;
        }
        if let Some(authority) = new_authority {
            config.authority = authority;
        }
        if let Some(fee_vault) = new_fee_vault {
            config.fee_vault = fee_vault;
        }
        Ok(())
    }

    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
        escrow_id: u64,
        amount: u64,
        expires_at: i64,
    ) -> Result<()> {
        require!(amount > 0, WolandError::ZeroAmount);
        let clock = Clock::get()?;
        require!(expires_at > clock.unix_timestamp, WolandError::ExpiryInPast);

        let escrow = &mut ctx.accounts.escrow;
        escrow.id = escrow_id;
        escrow.depositor = ctx.accounts.depositor.key();
        escrow.receiver = ctx.accounts.receiver.key();
        escrow.mint = ctx.accounts.mint.key();
        escrow.amount = amount;
        escrow.released = 0;
        escrow.phase = EscrowPhase::AwaitingDeposit;
        escrow.expires_at = expires_at;
        escrow.created_at = clock.unix_timestamp;
        escrow.dispute_opened_at = 0;
        escrow.milestone_count = 0;
        escrow.fee_bps = ctx.accounts.config.fee_bps;
        escrow.bump = ctx.bumps.escrow;
        escrow.vault_bump = ctx.bumps.vault;

        let config = &mut ctx.accounts.config;
        config.total_escrows = config.total_escrows.checked_add(1)
            .ok_or(WolandError::Overflow)?;

        emit!(EscrowCreated {
            escrow_id,
            depositor: ctx.accounts.depositor.key(),
            receiver: ctx.accounts.receiver.key(),
            amount,
            expires_at,
        });

        Ok(())
    }

    pub fn fund_escrow(ctx: Context<FundEscrow>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(escrow.phase == EscrowPhase::AwaitingDeposit, WolandError::InvalidPhase);
        require!(ctx.accounts.depositor.key() == escrow.depositor, WolandError::Unauthorized);

        let cpi_accounts = Transfer {
            from: ctx.accounts.depositor_token.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.depositor.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        token::transfer(cpi_ctx, escrow.amount)?;

        escrow.phase = EscrowPhase::Funded;

        let config = &mut ctx.accounts.config;
        config.total_volume = config.total_volume.checked_add(escrow.amount)
            .ok_or(WolandError::Overflow)?;

        emit!(EscrowFunded {
            escrow_id: escrow.id,
            amount: escrow.amount,
        });

        Ok(())
    }

    pub fn add_milestone(
        ctx: Context<AddMilestone>,
        title_hash: [u8; 32],
        amount: u64,
        deadline_offset: i64,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        let caller = ctx.accounts.authority.key();
        require!(
            caller == escrow.depositor || caller == escrow.receiver,
            WolandError::Unauthorized
        );
        require!(
            escrow.phase == EscrowPhase::Funded
                || escrow.phase == EscrowPhase::InProgress
                || escrow.phase == EscrowPhase::MilestoneCheck,
            WolandError::InvalidPhase
        );
        require!((escrow.milestone_count as usize) < MAX_MILESTONES, WolandError::TooManyMilestones);
        require!(amount > 0, WolandError::ZeroAmount);

        let total_milestone_amount: u64 = escrow.milestones[..escrow.milestone_count as usize]
            .iter()
            .map(|m| m.amount)
            .sum();
        let new_total = total_milestone_amount.checked_add(amount)
            .ok_or(WolandError::Overflow)?;
        require!(new_total <= escrow.amount, WolandError::MilestoneExceedsEscrow);

        let clock = Clock::get()?;
        let deadline = if deadline_offset > 0 {
            clock.unix_timestamp.checked_add(deadline_offset)
                .ok_or(WolandError::Overflow)?
        } else {
            0
        };

        let idx = escrow.milestone_count as usize;
        escrow.milestones[idx] = MilestoneData {
            title_hash,
            amount,
            deadline,
            status: MilestoneStatus::Pending,
        };
        escrow.milestone_count = escrow.milestone_count.checked_add(1)
            .ok_or(WolandError::Overflow)?;

        emit!(MilestoneAdded {
            escrow_id: escrow.id,
            milestone_idx: idx as u8,
            amount,
            deadline,
        });

        Ok(())
    }

    pub fn advance_phase(ctx: Context<AdvancePhase>, new_phase: u8) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        let caller = ctx.accounts.authority.key();
        require!(
            caller == escrow.depositor || caller == escrow.receiver,
            WolandError::Unauthorized
        );

        let phase = EscrowPhase::try_from(new_phase)
            .map_err(|_| WolandError::InvalidPhase)?;

        match (escrow.phase, phase) {
            (EscrowPhase::Funded, EscrowPhase::InProgress) => {
                require!(caller == escrow.receiver, WolandError::Unauthorized);
            }
            (EscrowPhase::InProgress, EscrowPhase::UnderReview) => {
                require!(caller == escrow.receiver, WolandError::Unauthorized);
            }
            (EscrowPhase::UnderReview, EscrowPhase::Disputed) => {
                require!(caller == escrow.depositor, WolandError::Unauthorized);
                escrow.dispute_opened_at = Clock::get()?.unix_timestamp;
            }
            _ => return Err(WolandError::InvalidPhaseTransition.into()),
        }

        let old_phase = escrow.phase;
        escrow.phase = phase;

        emit!(PhaseAdvanced {
            escrow_id: escrow.id,
            old_phase: old_phase as u8,
            new_phase: phase as u8,
            by: caller,
        });

        Ok(())
    }

    pub fn release_funds(ctx: Context<ReleaseFunds>) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        require!(escrow.phase == EscrowPhase::UnderReview, WolandError::InvalidPhase);
        require!(ctx.accounts.depositor.key() == escrow.depositor, WolandError::Unauthorized);

        let release_amount = escrow.amount.checked_sub(escrow.released)
            .ok_or(WolandError::InsufficientFunds)?;
        require!(release_amount > 0, WolandError::NothingToRelease);

        let fee = calculate_fee(release_amount, escrow.fee_bps)?;
        let net_amount = release_amount.checked_sub(fee)
            .ok_or(WolandError::Overflow)?;

        let escrow_id_bytes = escrow.id.to_le_bytes();
        let bump = escrow.bump;
        let depositor_key = escrow.depositor;
        let seeds = &[
            b"escrow" as &[u8],
            depositor_key.as_ref(),
            &escrow_id_bytes,
            &[bump],
        ];
        let signer_seeds = &[&seeds[..]];

        if net_amount > 0 {
            let cpi_accounts = Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.receiver_token.to_account_info(),
                authority: ctx.accounts.escrow.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer_seeds,
            );
            token::transfer(cpi_ctx, net_amount)?;
        }

        if fee > 0 {
            let cpi_accounts = Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.fee_vault.to_account_info(),
                authority: ctx.accounts.escrow.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer_seeds,
            );
            token::transfer(cpi_ctx, fee)?;
        }

        let escrow_mut = &mut ctx.accounts.escrow;
        escrow_mut.released = escrow_mut.released.checked_add(release_amount)
            .ok_or(WolandError::Overflow)?;
        escrow_mut.phase = EscrowPhase::Released;

        emit!(FundsReleased {
            escrow_id: escrow_mut.id,
            receiver: escrow_mut.receiver,
            net_amount,
            fee,
        });

        Ok(())
    }

    pub fn release_milestone(ctx: Context<ReleaseMilestone>, milestone_idx: u8) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        require!(
            escrow.phase == EscrowPhase::Funded
                || escrow.phase == EscrowPhase::InProgress
                || escrow.phase == EscrowPhase::MilestoneCheck,
            WolandError::InvalidPhase
        );
        require!(ctx.accounts.depositor.key() == escrow.depositor, WolandError::Unauthorized);
        require!((milestone_idx as usize) < escrow.milestone_count as usize, WolandError::InvalidMilestone);

        let milestone = &escrow.milestones[milestone_idx as usize];
        require!(milestone.status == MilestoneStatus::Submitted, WolandError::MilestoneNotSubmitted);
        let amount = milestone.amount;

        let remaining = escrow.amount.checked_sub(escrow.released)
            .ok_or(WolandError::InsufficientFunds)?;
        require!(amount <= remaining, WolandError::InsufficientFunds);

        let fee = calculate_fee(amount, escrow.fee_bps)?;
        let net_amount = amount.checked_sub(fee)
            .ok_or(WolandError::Overflow)?;

        let escrow_id_bytes = escrow.id.to_le_bytes();
        let bump = escrow.bump;
        let depositor_key = escrow.depositor;
        let prev_released = escrow.released;
        let total_amount = escrow.amount;
        let escrow_id = escrow.id;
        let seeds = &[
            b"escrow" as &[u8],
            depositor_key.as_ref(),
            &escrow_id_bytes,
            &[bump],
        ];
        let signer_seeds = &[&seeds[..]];

        if net_amount > 0 {
            let cpi_accounts = Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.receiver_token.to_account_info(),
                authority: ctx.accounts.escrow.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer_seeds,
            );
            token::transfer(cpi_ctx, net_amount)?;
        }

        if fee > 0 {
            let cpi_accounts = Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.fee_vault.to_account_info(),
                authority: ctx.accounts.escrow.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer_seeds,
            );
            token::transfer(cpi_ctx, fee)?;
        }

        let escrow_mut = &mut ctx.accounts.escrow;
        escrow_mut.milestones[milestone_idx as usize].status = MilestoneStatus::Approved;
        escrow_mut.released = prev_released.checked_add(amount)
            .ok_or(WolandError::Overflow)?;

        if escrow_mut.released >= total_amount {
            escrow_mut.phase = EscrowPhase::Released;
        } else {
            escrow_mut.phase = EscrowPhase::MilestoneCheck;
        }

        emit!(MilestoneReleased {
            escrow_id,
            milestone_idx,
            amount,
            fee,
            total_released: escrow_mut.released,
        });

        Ok(())
    }

    pub fn submit_milestone(ctx: Context<SubmitMilestone>, milestone_idx: u8) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        let caller = ctx.accounts.authority.key();
        require!(caller == escrow.receiver, WolandError::Unauthorized);
        require!(
            escrow.phase == EscrowPhase::Funded
                || escrow.phase == EscrowPhase::InProgress
                || escrow.phase == EscrowPhase::MilestoneCheck,
            WolandError::InvalidPhase
        );
        require!((milestone_idx as usize) < escrow.milestone_count as usize, WolandError::InvalidMilestone);

        let milestone = &escrow.milestones[milestone_idx as usize];
        require!(
            milestone.status == MilestoneStatus::Pending || milestone.status == MilestoneStatus::Rejected,
            WolandError::MilestoneNotSubmittable
        );

        if milestone.deadline > 0 {
            let clock = Clock::get()?;
            require!(clock.unix_timestamp <= milestone.deadline, WolandError::MilestoneExpired);
        }

        escrow.milestones[milestone_idx as usize].status = MilestoneStatus::Submitted;

        emit!(MilestoneSubmitted {
            escrow_id: escrow.id,
            milestone_idx,
        });

        Ok(())
    }

    pub fn reject_milestone(ctx: Context<RejectMilestone>, milestone_idx: u8) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        let caller = ctx.accounts.authority.key();
        require!(caller == escrow.depositor, WolandError::Unauthorized);
        require!(
            escrow.phase == EscrowPhase::Funded
                || escrow.phase == EscrowPhase::InProgress
                || escrow.phase == EscrowPhase::MilestoneCheck,
            WolandError::InvalidPhase
        );
        require!((milestone_idx as usize) < escrow.milestone_count as usize, WolandError::InvalidMilestone);

        let milestone = &escrow.milestones[milestone_idx as usize];
        require!(milestone.status == MilestoneStatus::Submitted, WolandError::MilestoneNotSubmitted);

        escrow.milestones[milestone_idx as usize].status = MilestoneStatus::Rejected;

        emit!(MilestoneRejected {
            escrow_id: escrow.id,
            milestone_idx,
        });

        Ok(())
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        let caller = ctx.accounts.authority.key();

        let clock = Clock::get()?;
        let expired = escrow.expires_at > 0 && clock.unix_timestamp > escrow.expires_at;

        let can_refund = match escrow.phase {
            EscrowPhase::Disputed => {
                caller == escrow.depositor
                    && escrow.dispute_opened_at > 0
                    && clock.unix_timestamp > escrow.dispute_opened_at + DISPUTE_WINDOW_SECONDS
            }
            EscrowPhase::Funded | EscrowPhase::InProgress | EscrowPhase::MilestoneCheck => {
                expired && caller == escrow.depositor
            }
            _ => false,
        };
        require!(can_refund, WolandError::RefundNotAllowed);

        let remaining = escrow.amount.checked_sub(escrow.released)
            .ok_or(WolandError::InsufficientFunds)?;
        require!(remaining > 0, WolandError::NothingToRelease);

        let escrow_id_bytes = escrow.id.to_le_bytes();
        let bump = escrow.bump;
        let depositor_key = escrow.depositor;
        let total_amount = escrow.amount;
        let escrow_id = escrow.id;
        let seeds = &[
            b"escrow" as &[u8],
            depositor_key.as_ref(),
            &escrow_id_bytes,
            &[bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.depositor_token.to_account_info(),
            authority: ctx.accounts.escrow.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );
        token::transfer(cpi_ctx, remaining)?;

        let escrow_mut = &mut ctx.accounts.escrow;
        escrow_mut.released = total_amount;
        escrow_mut.phase = EscrowPhase::Refunded;

        emit!(EscrowRefunded {
            escrow_id,
            depositor: depositor_key,
            amount: remaining,
        });

        Ok(())
    }

    pub fn arbiter_resolve(
        ctx: Context<ArbiterResolve>,
        depositor_share_bps: u16,
    ) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        require!(escrow.phase == EscrowPhase::Disputed, WolandError::InvalidPhase);
        require!(depositor_share_bps <= 10_000, WolandError::InvalidShareBps);

        let remaining = escrow.amount.checked_sub(escrow.released)
            .ok_or(WolandError::InsufficientFunds)?;
        require!(remaining > 0, WolandError::NothingToRelease);

        let fee = calculate_fee(remaining, escrow.fee_bps)?;
        let distributable = remaining.checked_sub(fee)
            .ok_or(WolandError::Overflow)?;
        let depositor_amount = distributable
            .checked_mul(depositor_share_bps as u64)
            .ok_or(WolandError::Overflow)?
            .checked_div(10_000)
            .ok_or(WolandError::Overflow)?;
        let receiver_amount = distributable.checked_sub(depositor_amount)
            .ok_or(WolandError::Overflow)?;

        let escrow_id_bytes = escrow.id.to_le_bytes();
        let bump = escrow.bump;
        let depositor_key = escrow.depositor;
        let escrow_id = escrow.id;
        let total_amount = escrow.amount;
        let seeds = &[
            b"escrow" as &[u8],
            depositor_key.as_ref(),
            &escrow_id_bytes,
            &[bump],
        ];
        let signer_seeds = &[&seeds[..]];

        if depositor_amount > 0 {
            let cpi_accounts = Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.depositor_token.to_account_info(),
                authority: ctx.accounts.escrow.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer_seeds,
            );
            token::transfer(cpi_ctx, depositor_amount)?;
        }

        if receiver_amount > 0 {
            let cpi_accounts = Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.receiver_token.to_account_info(),
                authority: ctx.accounts.escrow.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer_seeds,
            );
            token::transfer(cpi_ctx, receiver_amount)?;
        }

        if fee > 0 {
            let cpi_accounts = Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.fee_vault.to_account_info(),
                authority: ctx.accounts.escrow.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer_seeds,
            );
            token::transfer(cpi_ctx, fee)?;
        }

        let escrow_mut = &mut ctx.accounts.escrow;
        escrow_mut.released = total_amount;
        escrow_mut.phase = EscrowPhase::Released;

        emit!(DisputeResolved {
            escrow_id,
            arbiter: ctx.accounts.arbiter.key(),
            depositor_amount,
            receiver_amount,
            fee,
        });

        Ok(())
    }

    pub fn close_escrow(ctx: Context<CloseEscrow>) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        require!(
            escrow.phase == EscrowPhase::Released || escrow.phase == EscrowPhase::Refunded,
            WolandError::EscrowNotSettled
        );
        require!(ctx.accounts.depositor.key() == escrow.depositor, WolandError::Unauthorized);

        emit!(EscrowClosed {
            escrow_id: escrow.id,
        });

        Ok(())
    }
}

fn calculate_fee(amount: u64, fee_bps: u16) -> Result<u64> {
    if fee_bps == 0 {
        return Ok(0);
    }
    amount.checked_mul(fee_bps as u64)
        .ok_or(WolandError::Overflow.into())
        .and_then(|v| v.checked_div(10_000).ok_or(WolandError::Overflow.into()))
}

// --- Accounts ---

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + PlatformConfig::INIT_SPACE,
        seeds = [b"config"],
        bump,
    )]
    pub config: Account<'info, PlatformConfig>,
    pub fee_vault: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(constraint = authority.key() == config.authority @ WolandError::Unauthorized)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, PlatformConfig>,
}

#[derive(Accounts)]
#[instruction(escrow_id: u64)]
pub struct InitializeEscrow<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    /// CHECK: receiver pubkey - must not be zero address or same as depositor
    #[account(
        constraint = receiver.key() != Pubkey::default() @ WolandError::InvalidReceiver,
        constraint = receiver.key() != depositor.key() @ WolandError::InvalidReceiver,
    )]
    pub receiver: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = depositor,
        space = 8 + EscrowAccount::INIT_SPACE,
        seeds = [b"escrow", depositor.key().as_ref(), &escrow_id.to_le_bytes()],
        bump,
    )]
    pub escrow: Account<'info, EscrowAccount>,
    #[account(
        init,
        payer = depositor,
        token::mint = mint,
        token::authority = escrow,
        seeds = [b"vault", escrow.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, PlatformConfig>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct FundEscrow<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(
        mut,
        seeds = [b"escrow", escrow.depositor.as_ref(), &escrow.id.to_le_bytes()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, EscrowAccount>,
    #[account(
        mut,
        seeds = [b"vault", escrow.key().as_ref()],
        bump = escrow.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = depositor_token.owner == depositor.key() @ WolandError::Unauthorized,
        constraint = depositor_token.mint == escrow.mint @ WolandError::MintMismatch,
    )]
    pub depositor_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, PlatformConfig>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AddMilestone<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"escrow", escrow.depositor.as_ref(), &escrow.id.to_le_bytes()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, EscrowAccount>,
}

#[derive(Accounts)]
pub struct AdvancePhase<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"escrow", escrow.depositor.as_ref(), &escrow.id.to_le_bytes()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, EscrowAccount>,
}

#[derive(Accounts)]
pub struct SubmitMilestone<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"escrow", escrow.depositor.as_ref(), &escrow.id.to_le_bytes()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, EscrowAccount>,
}

#[derive(Accounts)]
pub struct RejectMilestone<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"escrow", escrow.depositor.as_ref(), &escrow.id.to_le_bytes()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, EscrowAccount>,
}

#[derive(Accounts)]
pub struct ReleaseFunds<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(
        mut,
        seeds = [b"escrow", escrow.depositor.as_ref(), &escrow.id.to_le_bytes()],
        bump = escrow.bump,
        constraint = depositor.key() == escrow.depositor @ WolandError::Unauthorized,
    )]
    pub escrow: Box<Account<'info, EscrowAccount>>,
    #[account(
        mut,
        seeds = [b"vault", escrow.key().as_ref()],
        bump = escrow.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = receiver_token.owner == escrow.receiver @ WolandError::Unauthorized,
        constraint = receiver_token.mint == escrow.mint @ WolandError::MintMismatch,
    )]
    pub receiver_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = fee_vault.key() == config.fee_vault @ WolandError::InvalidFeeVault,
        constraint = fee_vault.mint == escrow.mint @ WolandError::MintMismatch,
    )]
    pub fee_vault: Account<'info, TokenAccount>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, PlatformConfig>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ReleaseMilestone<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(
        mut,
        seeds = [b"escrow", escrow.depositor.as_ref(), &escrow.id.to_le_bytes()],
        bump = escrow.bump,
        constraint = depositor.key() == escrow.depositor @ WolandError::Unauthorized,
    )]
    pub escrow: Box<Account<'info, EscrowAccount>>,
    #[account(
        mut,
        seeds = [b"vault", escrow.key().as_ref()],
        bump = escrow.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = receiver_token.owner == escrow.receiver @ WolandError::Unauthorized,
        constraint = receiver_token.mint == escrow.mint @ WolandError::MintMismatch,
    )]
    pub receiver_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = fee_vault.key() == config.fee_vault @ WolandError::InvalidFeeVault,
        constraint = fee_vault.mint == escrow.mint @ WolandError::MintMismatch,
    )]
    pub fee_vault: Account<'info, TokenAccount>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, PlatformConfig>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"escrow", escrow.depositor.as_ref(), &escrow.id.to_le_bytes()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, EscrowAccount>,
    #[account(
        mut,
        seeds = [b"vault", escrow.key().as_ref()],
        bump = escrow.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = depositor_token.owner == escrow.depositor @ WolandError::Unauthorized,
        constraint = depositor_token.mint == escrow.mint @ WolandError::MintMismatch,
    )]
    pub depositor_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ArbiterResolve<'info> {
    #[account(constraint = arbiter.key() == config.arbiter @ WolandError::Unauthorized)]
    pub arbiter: Signer<'info>,
    #[account(
        mut,
        seeds = [b"escrow", escrow.depositor.as_ref(), &escrow.id.to_le_bytes()],
        bump = escrow.bump,
    )]
    pub escrow: Box<Account<'info, EscrowAccount>>,
    #[account(
        mut,
        seeds = [b"vault", escrow.key().as_ref()],
        bump = escrow.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = depositor_token.owner == escrow.depositor @ WolandError::Unauthorized,
        constraint = depositor_token.mint == escrow.mint @ WolandError::MintMismatch,
    )]
    pub depositor_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = receiver_token.owner == escrow.receiver @ WolandError::Unauthorized,
        constraint = receiver_token.mint == escrow.mint @ WolandError::MintMismatch,
    )]
    pub receiver_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = fee_vault.key() == config.fee_vault @ WolandError::InvalidFeeVault,
        constraint = fee_vault.mint == escrow.mint @ WolandError::MintMismatch,
    )]
    pub fee_vault: Account<'info, TokenAccount>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, PlatformConfig>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CloseEscrow<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(
        mut,
        close = depositor,
        seeds = [b"escrow", escrow.depositor.as_ref(), &escrow.id.to_le_bytes()],
        bump = escrow.bump,
        constraint = depositor.key() == escrow.depositor @ WolandError::Unauthorized,
    )]
    pub escrow: Account<'info, EscrowAccount>,
    #[account(
        mut,
        close = depositor,
        seeds = [b"vault", escrow.key().as_ref()],
        bump = escrow.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

// --- State ---

#[account]
#[derive(InitSpace)]
pub struct PlatformConfig {
    pub authority: Pubkey,
    pub arbiter: Pubkey,
    pub fee_bps: u16,
    pub fee_vault: Pubkey,
    pub total_escrows: u64,
    pub total_volume: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct EscrowAccount {
    pub id: u64,
    pub depositor: Pubkey,
    pub receiver: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub released: u64,
    pub phase: EscrowPhase,
    pub expires_at: i64,
    pub created_at: i64,
    pub dispute_opened_at: i64,
    pub fee_bps: u16,
    pub milestone_count: u8,
    pub milestones: [MilestoneData; 10],
    pub bump: u8,
    pub vault_bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Default)]
pub struct MilestoneData {
    pub title_hash: [u8; 32],
    pub amount: u64,
    pub deadline: i64,
    pub status: MilestoneStatus,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
#[repr(u8)]
pub enum EscrowPhase {
    AwaitingDeposit = 0,
    Funded = 1,
    InProgress = 2,
    UnderReview = 3,
    MilestoneCheck = 4,
    Released = 5,
    Refunded = 6,
    Disputed = 7,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Default)]
#[repr(u8)]
pub enum MilestoneStatus {
    #[default]
    Pending = 0,
    Submitted = 1,
    Approved = 2,
    Rejected = 3,
    Expired = 4,
}

impl TryFrom<u8> for EscrowPhase {
    type Error = ();
    fn try_from(v: u8) -> std::result::Result<Self, ()> {
        match v {
            0 => Ok(Self::AwaitingDeposit),
            1 => Ok(Self::Funded),
            2 => Ok(Self::InProgress),
            3 => Ok(Self::UnderReview),
            4 => Ok(Self::MilestoneCheck),
            5 => Ok(Self::Released),
            6 => Ok(Self::Refunded),
            7 => Ok(Self::Disputed),
            _ => Err(()),
        }
    }
}

// --- Events ---

#[event]
pub struct EscrowCreated {
    pub escrow_id: u64,
    pub depositor: Pubkey,
    pub receiver: Pubkey,
    pub amount: u64,
    pub expires_at: i64,
}

#[event]
pub struct EscrowFunded {
    pub escrow_id: u64,
    pub amount: u64,
}

#[event]
pub struct PhaseAdvanced {
    pub escrow_id: u64,
    pub old_phase: u8,
    pub new_phase: u8,
    pub by: Pubkey,
}

#[event]
pub struct MilestoneAdded {
    pub escrow_id: u64,
    pub milestone_idx: u8,
    pub amount: u64,
    pub deadline: i64,
}

#[event]
pub struct MilestoneSubmitted {
    pub escrow_id: u64,
    pub milestone_idx: u8,
}

#[event]
pub struct MilestoneRejected {
    pub escrow_id: u64,
    pub milestone_idx: u8,
}

#[event]
pub struct MilestoneReleased {
    pub escrow_id: u64,
    pub milestone_idx: u8,
    pub amount: u64,
    pub fee: u64,
    pub total_released: u64,
}

#[event]
pub struct FundsReleased {
    pub escrow_id: u64,
    pub receiver: Pubkey,
    pub net_amount: u64,
    pub fee: u64,
}

#[event]
pub struct EscrowRefunded {
    pub escrow_id: u64,
    pub depositor: Pubkey,
    pub amount: u64,
}

#[event]
pub struct DisputeResolved {
    pub escrow_id: u64,
    pub arbiter: Pubkey,
    pub depositor_amount: u64,
    pub receiver_amount: u64,
    pub fee: u64,
}

#[event]
pub struct EscrowClosed {
    pub escrow_id: u64,
}

// --- Errors ---

#[error_code]
pub enum WolandError {
    #[msg("Invalid escrow phase for this operation")]
    InvalidPhase,
    #[msg("Invalid phase transition")]
    InvalidPhaseTransition,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Nothing to release")]
    NothingToRelease,
    #[msg("Insufficient funds in escrow")]
    InsufficientFunds,
    #[msg("Refund not allowed in current state")]
    RefundNotAllowed,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Expiry timestamp must be in the future")]
    ExpiryInPast,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Platform fee exceeds maximum")]
    FeeTooHigh,
    #[msg("Invalid fee vault")]
    InvalidFeeVault,
    #[msg("Too many milestones")]
    TooManyMilestones,
    #[msg("Milestone total exceeds escrow amount")]
    MilestoneExceedsEscrow,
    #[msg("Invalid milestone index")]
    InvalidMilestone,
    #[msg("Milestone must be in submitted status")]
    MilestoneNotSubmitted,
    #[msg("Milestone cannot be submitted in current status")]
    MilestoneNotSubmittable,
    #[msg("Milestone deadline has passed")]
    MilestoneExpired,
    #[msg("Escrow must be released or refunded to close")]
    EscrowNotSettled,
    #[msg("Invalid share basis points")]
    InvalidShareBps,
    #[msg("Token mint does not match escrow mint")]
    MintMismatch,
    #[msg("Invalid receiver address")]
    InvalidReceiver,
}
