// "use strict";
// Object.defineProperty(exports, "__esModule", { value: true });
// exports.getUserStats = exports.addAchievement = exports.getLeaderboard = exports.updateSkills = exports.updateSession = exports.addXP = exports.initializeUserLevel = exports.getUserLevel = exports.levelValidation = void 0;
// const UserLevel_1 = require("../models/UserLevel");
// const express_validator_1 = require("express-validator");
// // Validation middleware
// exports.levelValidation = [
//     (0, express_validator_1.body)('userId')
//         .isString()
//         .notEmpty()
//         .withMessage('User ID is required'),
//     (0, express_validator_1.body)('userName')
//         .optional()
//         .isString()
//         .withMessage('User name must be a string'),
//     (0, express_validator_1.body)('userEmail')
//         .optional()
//         .isEmail()
//         .withMessage('Valid email is required')
// ];
// // Get user level data
// const getUserLevel = async (req, res) => {
//     try {
//         const { userId } = req.params;
//         if (!userId) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'User ID is required'
//             });
//         }
//         let userLevel = await UserLevel_1.UserLevel.findOne({ userId });
//         // If user level doesn't exist, create default one
//         if (!userLevel) {
//             return res.status(404).json({
//                 success: false,
//                 error: 'User level not found. Please initialize first.',
//                 code: 'LEVEL_NOT_FOUND'
//             });
//         }
//         res.json({
//             success: true,
//             data: userLevel
//         });
//     }
//     catch (error) {
//         console.error('Get user level error:', error);
//         res.status(500).json({
//             success: false,
//             error: error.message || 'Failed to get user level'
//         });
//     }
// };
// exports.getUserLevel = getUserLevel;
// // Initialize or get user level
// const initializeUserLevel = async (req, res) => {
//     try {
//         const errors = (0, express_validator_1.validationResult)(req);
//         if (!errors.isEmpty()) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'Validation failed',
//                 details: errors.array()
//             });
//         }
//         const { userId, userName, userEmail } = req.body;
//         // Check if user level already exists
//         let userLevel = await UserLevel_1.UserLevel.findOne({ userId });
//         if (userLevel) {
//             // Update user info if provided
//             if (userName)
//                 userLevel.userName = userName;
//             if (userEmail)
//                 userLevel.userEmail = userEmail;
//             await userLevel.save();
//             return res.json({
//                 success: true,
//                 data: userLevel,
//                 message: 'User level already exists'
//             });
//         }
//         // Create new user level
//         userLevel = new UserLevel_1.UserLevel({
//             userId,
//             userName: userName || 'User',
//             userEmail: userEmail || '',
//             level: 1,
//             currentXP: 0,
//             totalXP: 0,
//             xpToNextLevel: 500, // Changed from 100 to match frontend calculation
//             streak: 0,
//             longestStreak: 0,
//             totalSessions: 0,
//             lastSessionDate: new Date(),
//             accuracy: 0,
//             vocabulary: 0,
//             grammar: 0,
//             pronunciation: 0,
//             fluency: 0,
//             messagesCount: 0,
//             correctionsReceived: 0,
//             exercisesCompleted: 0,
//             achievements: [],
//             badges: []
//         });
//         await userLevel.save();
//         res.status(201).json({
//             success: true,
//             data: userLevel,
//             message: 'User level initialized successfully'
//         });
//     }
//     catch (error) {
//         console.error('Initialize user level error:', error);
//         res.status(500).json({
//             success: false,
//             error: error.message || 'Failed to initialize user level'
//         });
//     }
// };
// exports.initializeUserLevel = initializeUserLevel;
// // Add XP to user
// const addXP = async (req, res) => {
//     try {
//         const { userId } = req.params;
//         const { xpAmount, reason } = req.body;
//         if (!userId || !xpAmount) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'User ID and XP amount are required'
//             });
//         }
//         if (xpAmount <= 0 || xpAmount > 1000) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'XP amount must be between 1 and 1000'
//             });
//         }
//         const userLevel = await UserLevel_1.UserLevel.findOne({ userId });
//         if (!userLevel) {
//             return res.status(404).json({
//                 success: false,
//                 error: 'User level not found'
//             });
//         }
//         const previousLevel = userLevel.level;
//         const leveledUp = userLevel.addXP(xpAmount);
//         await userLevel.save();
//         res.json({
//             success: true,
//             data: {
//                 userLevel,
//                 leveledUp,
//                 previousLevel,
//                 newLevel: userLevel.level,
//                 xpGained: xpAmount,
//                 reason: reason || 'Activity completed'
//             }
//         });
//     }
//     catch (error) {
//         console.error('Add XP error:', error);
//         res.status(500).json({
//             success: false,
//             error: error.message || 'Failed to add XP'
//         });
//     }
// };
// exports.addXP = addXP;
// // Update user session
// const updateSession = async (req, res) => {
//     try {
//         const { userId } = req.params;
//         const userLevel = await UserLevel_1.UserLevel.findOne({ userId });
//         if (!userLevel) {
//             return res.status(404).json({
//                 success: false,
//                 error: 'User level not found'
//             });
//         }
//         userLevel.totalSessions += 1;
//         userLevel.updateStreak();
//         await userLevel.save();
//         res.json({
//             success: true,
//             data: userLevel
//         });
//     }
//     catch (error) {
//         console.error('Update session error:', error);
//         res.status(500).json({
//             success: false,
//             error: error.message || 'Failed to update session'
//         });
//     }
// };
// exports.updateSession = updateSession;
// // Update skill metrics
// const updateSkills = async (req, res) => {
//     try {
//         const { userId } = req.params;
//         const { accuracy, vocabulary, grammar, pronunciation, fluency } = req.body;
//         const userLevel = await UserLevel_1.UserLevel.findOne({ userId });
//         if (!userLevel) {
//             return res.status(404).json({
//                 success: false,
//                 error: 'User level not found'
//             });
//         }
//         // Update only provided metrics
//         if (accuracy !== undefined)
//             userLevel.accuracy = Math.min(100, Math.max(0, accuracy));
//         if (vocabulary !== undefined)
//             userLevel.vocabulary = Math.min(100, Math.max(0, vocabulary));
//         if (grammar !== undefined)
//             userLevel.grammar = Math.min(100, Math.max(0, grammar));
//         if (pronunciation !== undefined)
//             userLevel.pronunciation = Math.min(100, Math.max(0, pronunciation));
//         if (fluency !== undefined)
//             userLevel.fluency = Math.min(100, Math.max(0, fluency));
//         await userLevel.save();
//         res.json({
//             success: true,
//             data: userLevel
//         });
//     }
//     catch (error) {
//         console.error('Update skills error:', error);
//         res.status(500).json({
//             success: false,
//             error: error.message || 'Failed to update skills'
//         });
//     }
// };
// exports.updateSkills = updateSkills;
// // Get leaderboard
// const getLeaderboard = async (req, res) => {
//     try {
//         const { limit = 10, sortBy = 'totalXP' } = req.query;
//         const validSortFields = ['totalXP', 'level', 'streak'];
//         const sortField = validSortFields.includes(sortBy) ? sortBy : 'totalXP';
//         const leaderboard = await UserLevel_1.UserLevel.find()
//             .sort({ [sortField]: -1 })
//             .limit(Number(limit))
//             .select('userId userName level totalXP streak longestStreak');
//         res.json({
//             success: true,
//             data: leaderboard
//         });
//     }
//     catch (error) {
//         console.error('Get leaderboard error:', error);
//         res.status(500).json({
//             success: false,
//             error: error.message || 'Failed to get leaderboard'
//         });
//     }
// };
// exports.getLeaderboard = getLeaderboard;
// // Add achievement
// const addAchievement = async (req, res) => {
//     try {
//         const { userId } = req.params;
//         const { achievement } = req.body;
//         if (!achievement) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'Achievement is required'
//             });
//         }
//         const userLevel = await UserLevel_1.UserLevel.findOne({ userId });
//         if (!userLevel) {
//             return res.status(404).json({
//                 success: false,
//                 error: 'User level not found'
//             });
//         }
//         if (!userLevel.achievements.includes(achievement)) {
//             userLevel.achievements.push(achievement);
//             await userLevel.save();
//         }
//         res.json({
//             success: true,
//             data: userLevel
//         });
//     }
//     catch (error) {
//         console.error('Add achievement error:', error);
//         res.status(500).json({
//             success: false,
//             error: error.message || 'Failed to add achievement'
//         });
//     }
// };
// exports.addAchievement = addAchievement;
// // Get user stats
// const getUserStats = async (req, res) => {
//     try {
//         const { userId } = req.params;
//         const userLevel = await UserLevel_1.UserLevel.findOne({ userId });
//         if (!userLevel) {
//             return res.status(404).json({
//                 success: false,
//                 error: 'User level not found'
//             });
//         }
//         // Calculate additional stats
//         const averageSkill = Math.round((userLevel.accuracy + userLevel.vocabulary + userLevel.grammar +
//             userLevel.pronunciation + userLevel.fluency) / 5);
//         const stats = {
//             level: userLevel.level,
//             totalXP: userLevel.totalXP,
//             currentXP: userLevel.currentXP,
//             xpToNextLevel: userLevel.xpToNextLevel,
//             progressPercentage: Math.round((userLevel.currentXP / userLevel.xpToNextLevel) * 100),
//             streak: userLevel.streak,
//             longestStreak: userLevel.longestStreak,
//             totalSessions: userLevel.totalSessions,
//             skills: {
//                 accuracy: userLevel.accuracy,
//                 vocabulary: userLevel.vocabulary,
//                 grammar: userLevel.grammar,
//                 pronunciation: userLevel.pronunciation,
//                 fluency: userLevel.fluency,
//                 average: averageSkill
//             },
//             activity: {
//                 messagesCount: userLevel.messagesCount,
//                 correctionsReceived: userLevel.correctionsReceived,
//                 exercisesCompleted: userLevel.exercisesCompleted
//             },
//             achievements: userLevel.achievements,
//             badges: userLevel.badges
//         };
//         res.json({
//             success: true,
//             data: stats
//         });
//     }
//     catch (error) {
//         console.error('Get user stats error:', error);
//         res.status(500).json({
//             success: false,
//             error: error.message || 'Failed to get user stats'
//         });
//     }
// };
// exports.getUserStats = getUserStats;
// //# sourceMappingURL=level.controller.js.map