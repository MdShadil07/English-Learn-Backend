# 🧠 Centralized Calculation Logic

This document outlines the core logic for Accuracy, XP, and Level calculations, which are now exclusively handled by the backend to ensure consistency, reliability, and security.

## 🎯 Accuracy Calculation

Accuracy is calculated using a multi-layered approach:

1.  **NLP Analysis**: The core analysis is performed using LanguageTool and custom NLP heuristics.
2.  **Weighted Scoring**:
    *   **Grammar**: 30%
    *   **Vocabulary**: 30%
    *   **Spelling**: 20%
    *   **Fluency**: 20%
3.  **Tier Adjustments**:
    *   **Free**: Basic analysis.
    *   **Pro**: Enhanced grammar and style checks.
    *   **Premium**: Deep semantic analysis and coherence checks.

### Historical Accuracy
We use an exponential moving average (EMA) to track user accuracy over time, giving more weight to recent performance while preserving historical trends.

## ⚡ XP Calculation

XP (Experience Points) are awarded based on:

1.  **Base XP**: 10 XP per message (standard).
2.  **Multipliers**:
    *   **Accuracy**: Up to 1.5x for high accuracy (>90%).
    *   **Streak**: +5% per day, capped at 50%.
    *   **Tier**:
        *   Pro: 1.2x
        *   Premium: 1.5x
3.  **Penalties**:
    *   Significant grammar errors may reduce XP gain, but XP will never be negative for a valid attempt.

**Formula:**
`Total XP = (Base XP * Accuracy Multiplier * Streak Multiplier * Tier Multiplier) + Bonus XP`

## 🏆 Leveling System

Leveling follows a non-linear curve to ensure a sense of progression that scales with skill.

**Formula:**
`XP Required = Base * (Level ^ Exponent)`

*   **Base**: 100 XP
*   **Exponent**: 1.5

### Proficiency Tiers
Levels are mapped to CEFR-like proficiency tiers:
*   **Novice**: Levels 1-10
*   **Beginner**: Levels 11-30
*   **Intermediate**: Levels 31-60
*   **Advanced**: Levels 61-90
*   **Expert**: Levels 91+

## 🔒 Security & Integrity

*   **Server-Side Authority**: All calculations occur on the server. The client only displays the results.
*   **Validation**: Input data is validated before processing.
*   **Anti-Cheat**: Rate limiting and anomaly detection prevent XP farming.
