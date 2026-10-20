const test = require('node:test');
const assert = require('node:assert');

const { combineDecisions } = require('../utils/aiAccess');

const d = (level, value) => ({ level, value });

test('a user "enabled" cannot switch AI back on after an admin disabled it', () => {
    // This is the whole point of the resolver: an admin's disable is not
    // overridable by the account it applies to.
    assert.strictEqual(combineDecisions([d('global', 'disabled'), d('user', 'enabled')]).enabled, false);
    assert.strictEqual(combineDecisions([d('school', 'disabled'), d('user', 'enabled')]).enabled, false);
    assert.strictEqual(combineDecisions([d('user', 'disabled'), d('global', 'enabled')]).enabled, false);
});

test('an explicit enable at any level grants access when nothing disables it', () => {
    assert.strictEqual(combineDecisions([d('global', 'enabled'), d('user', null)]).enabled, true);
    assert.strictEqual(combineDecisions([d('global', 'enabled'), d('school', null)]).enabled, true);
});

test('absent settings (null) never grant access', () => {
    assert.strictEqual(combineDecisions([d('global', null), d('user', null)]).enabled, false);
    assert.strictEqual(combineDecisions([]).enabled, false);
});

test('reports which level decided, for audit logs and admin UI', () => {
    assert.match(combineDecisions([d('global', 'disabled'), d('user', 'enabled')]).reason, /global/);
    assert.match(combineDecisions([d('global', 'enabled'), d('user', 'enabled')]).reason, /global/);
    assert.match(combineDecisions([d('school', null), d('user', null)]).reason, /no explicit grant/);
});

test('an unknown value is treated as inherit, not as a grant', () => {
    assert.strictEqual(combineDecisions([d('global', 'weird')]).enabled, false);
});
