/**
 * Backend Progress Calculator
 * Handles XP calculations, level progression, and skill tracking
 */
/**
 * XP rewards for different actions
 */
const XP_REWARDS = {
    send_message: 10,
    receive_response: 5,
    complete_exercise: 25,
    daily_streak: 15,
    perfect_grammar: 20,
    vocabulary_milestone: 30,
    achievement_unlock: 50,
    level_up_bonus: 100,
    session_complete: 15,
    first_message: 10,
    long_conversation: 20,
    quick_response: 5,
    detailed_response: 15,
    helpful_correction: 10,
    consistent_practice: 25,
    accuracy_improvement: 15,
    vocabulary_expansion: 20,
    grammar_mastery: 25,
    fluency_achievement: 30
};
/**
 * Calculate XP required for a specific level
 */
export const calculateXPForLevel = (level) => {
    if (level <= 1)
        return 0;
    return Math.floor(500 * Math.pow(1.1, level - 2));
};
/**
 * Calculate total XP required to reach a level
 */
export const calculateTotalXPForLevel = (targetLevel) => {
    let total = 0;
    for (let level = 1; level < targetLevel; level++) {
        total += calculateXPForLevel(level);
    }
    return total;
};
/**
 * Calculate current level from total XP
 */
export const calculateLevelFromXP = (totalXP) => {
    let level = 1;
    let requiredXP = 0;
    while (requiredXP <= totalXP) {
        level++;
        requiredXP = calculateTotalXPForLevel(level);
    }
    return level - 1;
};
/**
 * Calculate XP for next level
 */
export const calculateXPForNextLevel = (currentLevel) => {
    return calculateXPForLevel(currentLevel + 1);
};
/**
 * Calculate current XP within current level
 */
export const calculateCurrentLevelXP = (totalXP, currentLevel) => {
    const xpForPreviousLevel = calculateTotalXPForLevel(currentLevel);
    return totalXP - xpForPreviousLevel;
};
/**
 * Calculate XP needed to reach next level
 */
export const calculateXPToNextLevel = (totalXP, currentLevel) => {
    const xpForNextLevel = calculateTotalXPForLevel(currentLevel + 1);
    return xpForNextLevel - totalXP;
};
/**
 * Get comprehensive level information
 */
export const getLevelInfo = (totalXP) => {
    const level = calculateLevelFromXP(totalXP);
    const currentLevelXP = calculateCurrentLevelXP(totalXP, level);
    const xpToNextLevel = calculateXPForNextLevel(level);
    const progressPercentage = Math.round((currentLevelXP / xpToNextLevel) * 100);
    return {
        level,
        currentXP: currentLevelXP,
        xpToNextLevel,
        progressPercentage,
    };
};
/**
 * Calculate XP reward for an action
 */
export const calculateXPReward = (action, multiplier = 1.0, customXP) => {
    const baseXP = customXP || XP_REWARDS[action] || 5;
    // Apply streak multiplier
    if (action.includes('streak')) {
        multiplier *= 1.5;
    }
    // Apply length multiplier for conversations
    if (action.includes('conversation') || action.includes('response')) {
        multiplier = Math.min(multiplier * 1.2, 2.0);
    }
    // Apply accuracy multiplier
    if (action.includes('accuracy') || action.includes('grammar') || action.includes('vocabulary')) {
        multiplier = Math.min(multiplier * 1.1, 1.8);
    }
    const totalXP = Math.round(baseXP * multiplier);
    let reason = `${action.replace(/_/g, ' ')} (+${totalXP} XP)`;
    if (multiplier !== 1.0) {
        reason += ` x${multiplier}`;
    }
    return {
        totalXP,
        reason,
        baseXP,
        multiplier
    };
};
/**
 * Check if user leveled up
 */
export const checkLevelUp = (oldXP, newXP) => {
    return calculateLevelFromXP(newXP) > calculateLevelFromXP(oldXP);
};
/**
 * Calculate average skill level
 */
export const calculateAverageSkillLevel = (skills) => {
    const skillValues = Object.values(skills).filter(val => val !== undefined);
    if (skillValues.length === 0)
        return 0;
    return Math.round(skillValues.reduce((sum, skill) => sum + skill, 0) / skillValues.length);
};
/**
 * Generate progress summary
 */
export const generateProgressSummary = (totalXP, skills) => {
    const levelInfo = getLevelInfo(totalXP);
    return {
        level: levelInfo.level,
        currentXP: levelInfo.currentXP,
        xpToNext: levelInfo.xpToNextLevel,
        progress: `${levelInfo.currentXP}/${levelInfo.xpToNextLevel} XP`,
        progressPercentage: levelInfo.progressPercentage,
        averageSkill: calculateAverageSkillLevel(skills),
        totalXP,
        nextLevelXP: levelInfo.xpToNextLevel,
        skills
    };
};
//# sourceMappingURL=progressCalculator.js.map