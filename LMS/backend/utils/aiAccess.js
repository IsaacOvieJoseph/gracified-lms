// ─── Single source of truth for AI access ─────────────────────────────────────
// Every AI surface — the REST routes in routes/ai.js and every MCP tool — must
// resolve access through this module. When gating lived only in route
// middleware it drifted, and two real gaps resulted:
//
//   * Staff access ignored the global and school switches entirely, so a root
//     admin who switched student AI off, or a school that switched AI off, had
//     no way to stop teachers still using it.
//   * The `generate-*` routes were guarded by `auth` alone, so an account with
//     AI fully disabled could still reach every generator.
//
// Precedence is global -> school -> user, and it is deliberately NOT
// last-writer-wins. Any explicit "disabled" at any level wins, because an admin
// disabling AI must take effect immediately: it would be wrong for a user's own
// "enabled" override to switch AI back on after the admin turned it off. Only
// when nothing is disabled does any explicit "enabled" turn it on.

const Settings = require('../models/Settings');
const School = require('../models/School');

const todayKey = () => new Date().toISOString().slice(0, 10);

const explicit = (value) => (value === 'enabled' || value === 'disabled' ? value : null);

/**
 * Combine layered decisions. `disabled` always wins, in any order.
 * @param {Array<{level: string, value: string|null}>} decisions
 */
const combineDecisions = (decisions) => {
    const stated = decisions.filter((d) => d.value !== null);
    const blockedBy = stated.find((d) => d.value === 'disabled');
    if (blockedBy) return { enabled: false, reason: `disabled at ${blockedBy.level}` };
    const enabledBy = stated.find((d) => d.value === 'enabled');
    if (enabledBy) return { enabled: true, reason: `enabled at ${enabledBy.level}` };
    return { enabled: false, reason: 'no explicit grant' };
};

const loadSchoolDecision = async (user) => {
    const schoolId = Array.isArray(user.schoolId) ? user.schoolId[0] : user.schoolId;
    if (!schoolId) return null;
    try {
        const school = await School.findById(schoolId).select('aiTutorAccess').lean();
        return school ? explicit(school.aiTutorAccess) : null;
    } catch (_) {
        // A malformed schoolId must not fail open. Treat the lookup as absent and
        // let the global/user layers decide.
        return null;
    }
};

/**
 * Resolve whether the account may connect its OWN AI model provider (BYO
 * Gemini / OpenRouter) — the "Your AI Provider" / MCP section in Profile.
 *
 * This is separate from `resolveAIAccess` (which only decides whether the
 * platform AI surfaces are on at all). A root admin grants BYO access per
 * institution:
 *
 *   - School staff (school_admin / teacher) -> School.allowOwnAIModels
 *   - Personal teachers (no school)          -> User.allowOwnAIModels
 *   - Root admin                             -> always allowed (they own it)
 *   - Everyone else                          -> denied unless a school grants it
 *
 * Denied by default so a newly created school/tutor cannot start self-serving
 * BYO credentials until an admin opts them in.
 *
 * @returns {Promise<boolean>}
 */
const resolveOwnAIModelsAccess = async (user) => {
    if (!user) return false;
    // Root admin operates the platform and is never blocked from BYO access.
    if (user.role === 'root_admin') return true;
    // BYO providers are a staff capability (school staff / personal tutors).
    // Students never connect their own provider, even if the school allows it.
    if (user.role === 'student') return false;

    const schoolId = Array.isArray(user.schoolId) ? user.schoolId[0] : user.schoolId;

    if (schoolId) {
        try {
            const school = await School.findById(schoolId).select('allowOwnAIModels').lean();
            return Boolean(school && school.allowOwnAIModels);
        } catch (_) {
            // Fail closed: an unresolvable school must not grant BYO access.
            return false;
        }
    }

    // No school attached — personal teachers and independent accounts are
    // governed by their own user-level flag.
    return Boolean(user.allowOwnAIModels);
};

/**
 * Resolve effective AI access for a user.
 *
 * Students additionally carry a daily interaction quota; staff are unmetered.
 *
 * @returns {{enabled: boolean, reason: string, dailyLimit: number,
 *            isStudent: boolean, meterApplies: boolean, globalProvider: string}}
 */
const resolveAIAccess = async (user) => {
    const isStudent = user.role === 'student';
    const settings = await Settings.findOne().lean();

    const dailyLimit = Math.min(
        1000,
        Math.max(1, parseInt(settings?.studentAIDailyLimit) || 20)
    );

    const decisions = isStudent
        ? [
              { level: 'global', value: settings?.studentAIEnabled ? 'enabled' : 'disabled' },
              { level: 'school', value: await loadSchoolDecision(user) },
              { level: 'user', value: explicit(user.aiTutorAccess) },
          ]
        : [
              { level: 'global', value: settings?.staffAIEnabled === false ? 'disabled' : 'enabled' },
              { level: 'school', value: await loadSchoolDecision(user) },
              { level: 'user', value: explicit(user.aiTutorAccess) },
          ];

    const { enabled, reason } = combineDecisions(decisions);

    return {
        enabled,
        reason,
        dailyLimit,
        isStudent,
        meterApplies: isStudent,
        globalProvider: settings?.activeAIProvider || 'groq',
    };
};

/** Interactions already spent today by this student. */
const getUsageToday = (user) => {
    const usage = user.aiTutorUsage || {};
    return usage.usageDate === todayKey() ? usage.count || 0 : 0;
};

/**
 * Throw a typed error when the caller may not use AI. Used by MCP tools, where
 * a thrown denial is turned into a tool result the model can relay.
 */
const assertAIAccess = async (user, { consume = false } = {}) => {
    const access = await resolveAIAccess(user);
    if (!access.enabled) {
        const err = new Error(
            'AI features are disabled for your account. Ask your academy administrator to enable them.'
        );
        err.status = 403;
        err.code = 'AI_DISABLED';
        throw err;
    }
    if (access.meterApplies) {
        const usedToday = getUsageToday(user);
        if (usedToday >= access.dailyLimit) {
            const err = new Error(
                `You have reached today's AI limit (${access.dailyLimit} interactions). Try again tomorrow.`
            );
            err.status = 429;
            err.code = 'AI_QUOTA_EXCEEDED';
            err.dailyLimit = access.dailyLimit;
            throw err;
        }
        if (consume) {
            const usage = user.aiTutorUsage || {};
            user.aiTutorUsage =
                usage.usageDate === todayKey()
                    ? { usageDate: todayKey(), count: (usage.count || 0) + 1 }
                    : { usageDate: todayKey(), count: 1 };
            await user.save();
        }
    }
    return access;
};

/**
 * Express middleware for AI-consuming REST endpoints.
 *
 * @param {{consume?: boolean}} options consume=true debits one quota unit.
 */
const requireAIAccess = (options = {}) => async (req, res, next) => {
    try {
        const access = await assertAIAccess(req.user, options);
        req.aiAccess = access;
        req.aiTutor = { access, usedToday: getUsageToday(req.user) };
        next();
    } catch (err) {
        res.status(err.status || 500).json({
            message: err.message,
            code: err.code,
        });
    }
};

/** Read-only AI surfaces: check enablement, never consume quota. */
const requireAIReadAccess = () => requireAIAccess({ consume: false });

module.exports = {
    resolveAIAccess,
    resolveOwnAIModelsAccess,
    assertAIAccess,
    requireAIAccess,
    requireAIReadAccess,
    getUsageToday,
    combineDecisions,
    todayKey,
};
