# Trial power simulation (planning tool)

**Simulation for planning only. Not real trial results. Assumed effect: +8 points.**

This folder helps plan a proposed trial of HerbBridge 中西通. Nothing here comes from a trial;
no patients took part. It is not part of the app: the app does not load or link to these files.

## Proposed trial

- Randomised controlled trial, 2 arms: HerbBridge + usual care vs usual care, 6 months.
- Primary outcome: time in therapeutic range (TTR, %) for patients taking warfarin.

## Inputs and where each number comes from

| Input | Value | Source |
|---|---|---|
| Control arm mean TTR | 40.2% | Lam et al. 2020, *Hong Kong Medical Journal* |
| SD of TTR | 17.1 | Lam et al. 2020, *Hong Kong Medical Journal* (used for both arms, as in the formula) |
| Effect of HerbBridge on TTR | **+8 percentage points** | **ASSUMPTION by the HerbBridge team. Not from a source.** |
| Significance level | 0.05, two-sided | Trial design choice |
| Target power | 80% | Trial design choice |
| Dropout | 20% | Trial design choice |

Simulation settings (not trial inputs): 5,000 simulated trials per setting, fixed random seed 2026,
sample sizes 20 to 140 per arm in steps of 4, assumed effects +4 to +12 points in steps of 1.

## Formula check

n per arm = 2 × (1.96 + 0.84)² × 17.1² / 8² = 71.6, rounded up to **72 per arm**.
With 20% dropout: 72 / 0.8 = **90 per arm, 180 in total**.

## How the simulation works

For each setting, `power_sim.py` simulates 5,000 trials. In each trial, TTR for every patient is
drawn from a normal distribution (control: mean 40.2, SD 17.1; HerbBridge arm: mean 40.2 + the
assumed effect, SD 17.1), clipped to 0–100 because TTR is a percentage. The two arms are compared
with a two-sided t-test. Power is the share of simulated trials with p < 0.05.

## Results

With 72 patients analysed per arm and the **assumed** +8 points:

- **Simulated power: 79.6%** (95% simulation interval 78.5% to 80.7%).
- Exact t-test power without clipping: 79.6%, so the simulation agrees with the t-test.
- The formula gives 80% because it uses the normal approximation (1.96 and 0.84). A t-test needs
  slightly more: 73 per arm gives 80.2% (exact t-test). The difference is within the simulation's
  margin, and 90 per arm randomised still allows for 20% dropout.
- Clipping to 0–100 changes very little: the simulated difference between arms is 7.96 points
  instead of 8, and the SD is about 17.0 instead of 17.1.

How power changes if the real effect is smaller or larger than assumed (72 per arm):

| Assumed effect | +4 | +5 | +6 | +7 | **+8** | +9 | +10 | +11 | +12 |
|---|---|---|---|---|---|---|---|---|---|
| Simulated power | 28.4% | 42.0% | 54.8% | 67.4% | **79.6%** | 87.8% | 93.3% | 96.9% | 98.5% |

If the true effect were +6 points rather than +8, a trial of 72 per arm would have only about 55%
power. All numbers are in `results.txt`.

Charts:

- `power_vs_sample_size.png`: power vs patients analysed per arm, at the assumed +8 points.
- `power_vs_effect.png`: power vs assumed effect (+4 to +12 points), at 72 per arm.

## Rerun it

```
pip install numpy scipy matplotlib
python3 trial-sim/power_sim.py
```

This rewrites `results.txt` and both charts. The seed is fixed, so every run gives the same
numbers. To try other inputs, change the values at the top of `power_sim.py`.
