#!/usr/bin/env python3
"""
Power simulation for the proposed HerbBridge trial. A PLANNING TOOL, NOT TRIAL RESULTS.

Design: 2-arm randomised controlled trial (HerbBridge + usual care vs usual care), 6 months.
Primary outcome: time in therapeutic range (TTR, %) for warfarin patients.

Each simulated trial draws TTR for both arms from a normal distribution, clipped to 0-100,
and compares the arms with a two-sided t-test. Power = share of simulated trials with p < alpha.

Run:  python3 trial-sim/power_sim.py
Writes trial-sim/results.txt, trial-sim/power_vs_sample_size.png and trial-sim/power_vs_effect.png.
"""
import os

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from scipy import stats

HERE = os.path.dirname(os.path.abspath(__file__))

# ---- Inputs (README.md gives the source of each) ----
CONTROL_MEAN = 40.2      # control arm mean TTR, % (Lam et al. 2020, Hong Kong Medical Journal)
SD = 17.1                # SD of TTR, % (Lam et al. 2020); used for both arms, as in the formula
EFFECT = 8.0             # ASSUMPTION: +8 percentage points with HerbBridge. Not from a source.
ALPHA = 0.05             # two-sided
TARGET_POWER = 0.80
DROPOUT = 0.20
N_FORMULA = 72           # per arm, from the formula check below

# ---- Simulation settings (not trial inputs) ----
N_SIMS = 5000            # simulated trials per setting
SEED = 2026              # fixed, so every run gives the same results
SIZES = list(range(20, 141, 4))                    # per arm, chart 1 (includes 72)
EFFECTS = [float(e) for e in range(4, 13)]         # +4 to +12 points, chart 2

NOTE = 'Simulation for planning only. Not real trial results. Assumed effect: +8 points.'


def formula_n(effect=EFFECT, sd=SD, alpha=ALPHA, power=TARGET_POWER, z_alpha=None, z_beta=None):
    """n per arm = 2 x (z_alpha/2 + z_beta)^2 x SD^2 / effect^2 (normal approximation)."""
    za = stats.norm.ppf(1 - alpha / 2) if z_alpha is None else z_alpha
    zb = stats.norm.ppf(power) if z_beta is None else z_beta
    return 2 * (za + zb) ** 2 * sd ** 2 / effect ** 2


def simulate_power(n_per_arm, effect, n_sims=N_SIMS):
    """Share of simulated trials (t-test, two-sided) with p < ALPHA, and its Monte Carlo SE.
    Each setting has its own random stream from SEED, so a setting gives the same answer wherever
    it appears (72 per arm at +8 points is the same number in results.txt and both charts)."""
    rng = np.random.default_rng([SEED, n_per_arm, int(round(effect * 100))])
    control = np.clip(rng.normal(CONTROL_MEAN, SD, size=(n_sims, n_per_arm)), 0, 100)
    treated = np.clip(rng.normal(CONTROL_MEAN + effect, SD, size=(n_sims, n_per_arm)), 0, 100)
    p = stats.ttest_ind(treated, control, axis=1).pvalue
    power = float(np.mean(p < ALPHA))
    return power, float(np.sqrt(power * (1 - power) / n_sims))


def analytic_t_power(n_per_arm, effect):
    """Exact power of the two-sided t-test without clipping (noncentral t), for comparison."""
    df = 2 * n_per_arm - 2
    nc = effect / (SD * np.sqrt(2 / n_per_arm))
    t_crit = stats.t.ppf(1 - ALPHA / 2, df)
    return float(1 - stats.nct.cdf(t_crit, df, nc) + stats.nct.cdf(-t_crit, df, nc))


def chart(x, y, se, xlabel, title, mark_x, path, x_ticks=None):
    fig, ax = plt.subplots(figsize=(8, 5.2))
    y, se = np.array(y) * 100, np.array(se) * 100
    ax.fill_between(x, y - 1.96 * se, y + 1.96 * se, color='#4B3FD1', alpha=0.15, linewidth=0,
                    label='95% simulation interval')
    ax.plot(x, y, color='#4B3FD1', marker='o', markersize=3.5, linewidth=1.8, label='Simulated power (t-test)')
    ax.axhline(TARGET_POWER * 100, color='#555', linestyle='--', linewidth=1, label='Target power 80%')
    ax.axvline(mark_x, color='#B3261E', linestyle=':', linewidth=1.2)
    i = list(x).index(mark_x)
    ax.annotate('%.1f%%' % y[i], (mark_x, y[i]), textcoords='offset points', xytext=(8, -14), color='#B3261E')
    ax.set_xlabel(xlabel)
    ax.set_ylabel('Power (%)')
    ax.set_ylim(0, 100)
    if x_ticks is not None:
        ax.set_xticks(x_ticks)
    ax.grid(True, alpha=0.3)
    ax.set_title(title, fontsize=11)
    ax.legend(loc='lower right', fontsize=9)
    fig.text(0.5, 0.01, NOTE, ha='center', fontsize=9, style='italic', color='#B3261E')
    fig.tight_layout(rect=(0, 0.04, 1, 1))
    fig.savefig(path, dpi=150)
    plt.close(fig)


def main():
    rng = np.random.default_rng(SEED)  # for the clipping check only
    lines = [NOTE, '']

    # 1. Formula check
    n_rounded = formula_n(z_alpha=1.96, z_beta=0.84)
    n_exact = formula_n()
    randomised = int(np.ceil(N_FORMULA / (1 - DROPOUT)))
    lines += [
        'Formula: n = 2 x (1.96 + 0.84)^2 x 17.1^2 / 8^2',
        '  with 1.96 and 0.84:          n = %.2f per arm -> %d' % (n_rounded, int(np.ceil(n_rounded))),
        '  with exact z (%.4f, %.4f): n = %.2f per arm -> %d' % (stats.norm.ppf(1 - ALPHA / 2), stats.norm.ppf(TARGET_POWER), n_exact, int(np.ceil(n_exact))),
        '  with 20%% dropout: %d / 0.8 = %d per arm, %d in total' % (N_FORMULA, randomised, 2 * randomised),
        '',
    ]

    # 2. Simulated power at 72 per arm
    p72, se72 = simulate_power(N_FORMULA, EFFECT)
    clip_c = np.clip(rng.normal(CONTROL_MEAN, SD, 1_000_000), 0, 100)
    clip_t = np.clip(rng.normal(CONTROL_MEAN + EFFECT, SD, 1_000_000), 0, 100)
    lines += [
        'Simulated power at %d per arm, +%g points (assumed), %d trials: %.1f%% (95%% simulation interval %.1f%% to %.1f%%)'
        % (N_FORMULA, EFFECT, N_SIMS, p72 * 100, (p72 - 1.96 * se72) * 100, (p72 + 1.96 * se72) * 100),
        'Exact t-test power at %d per arm without clipping (noncentral t): %.1f%%' % (N_FORMULA, analytic_t_power(N_FORMULA, EFFECT) * 100),
        'Effect of clipping to 0-100 (1,000,000 draws per arm): control mean %.2f, SD %.2f; HerbBridge arm mean %.2f, SD %.2f; difference %.2f points'
        % (clip_c.mean(), clip_c.std(), clip_t.mean(), clip_t.std(), clip_t.mean() - clip_c.mean()),
        '',
    ]

    # 3. Power vs sample size per arm (at +8 points)
    res = [simulate_power(n, EFFECT) for n in SIZES]
    chart(SIZES, [r[0] for r in res], [r[1] for r in res], 'Patients analysed per arm',
          'Power vs sample size per arm (TTR, assumed effect +8 points, SD 17.1, alpha 0.05)',
          N_FORMULA, os.path.join(HERE, 'power_vs_sample_size.png'), x_ticks=list(range(20, 141, 20)))
    lines.append('Power vs sample size per arm (assumed effect +8 points):')
    lines += ['  %3d per arm: %5.1f%%' % (n, r[0] * 100) for n, r in zip(SIZES, res)]
    first = next((n for n, r in zip(SIZES, res) if r[0] >= TARGET_POWER), None)
    lines += ['  smallest size on this grid with simulated power >= 80%%: %s per arm' % first, '']

    # 4. Power vs assumed effect (at 72 per arm)
    res = [simulate_power(N_FORMULA, e) for e in EFFECTS]
    chart(EFFECTS, [r[0] for r in res], [r[1] for r in res], 'Assumed effect on TTR (percentage points)',
          'Power vs assumed effect (72 analysed per arm, SD 17.1, alpha 0.05)',
          EFFECT, os.path.join(HERE, 'power_vs_effect.png'), x_ticks=EFFECTS)
    lines.append('Power vs assumed effect (72 per arm):')
    lines += ['  +%2g points: %5.1f%%' % (e, r[0] * 100) for e, r in zip(EFFECTS, res)]

    lines += ['', 'Seed %d, %d simulated trials per setting.' % (SEED, N_SIMS)]
    with open(os.path.join(HERE, 'results.txt'), 'w') as f:
        f.write('\n'.join(lines) + '\n')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
