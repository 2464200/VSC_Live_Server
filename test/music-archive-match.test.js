const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getBranoMatchProfile,
  resolveMusicArchiveMatch
} = require('../Bordero/server/music-archive-match');

test('resolves a strong ID-based match as exact', () => {
  const profile = getBranoMatchProfile({
    id: '439',
    titolo: 'Walking the Line',
    coreografia: 'Walking the Line',
    brano: 'Walking the Line',
    autore: 'Carrie Underwood'
  });

  const candidates = [
    {
      baseName: '439 (WALKING THE LINE) 4th of July',
      normalizedName: '439 walking the line 4th of july',
      tokens: ['439', 'walking', 'the', 'line', '4th', 'of', 'july']
    },
    {
      baseName: '443 (WALKING THE LINE) Wild Angels',
      normalizedName: '443 walking the line wild angels',
      tokens: ['443', 'walking', 'the', 'line', 'wild', 'angels']
    }
  ];

  const result = resolveMusicArchiveMatch(profile, candidates, { minScore: 140 });

  assert.equal(profile.idPrefix, '439');
  assert.equal(result.status, 'exact');
  assert.equal(result.match?.baseName, '439 (WALKING THE LINE) 4th of July');
  assert.ok(result.candidates[0].score >= result.candidates[1].score);
});

test('returns ambiguous when the top candidates are too close', () => {
  const profile = getBranoMatchProfile({
    id: '',
    titolo: 'Boot Scootin Boogie',
    coreografia: 'Boot Scootin Boogie',
    brano: 'Boot Scootin Boogie'
  });

  const candidates = [
    {
      baseName: 'Boot Scootin Boogie',
      normalizedName: 'boot scootin boogie',
      tokens: ['boot', 'scootin', 'boogie']
    },
    {
      baseName: 'Boot Scootin Boogie 2',
      normalizedName: 'boot scootin boogie 2',
      tokens: ['boot', 'scootin', 'boogie', '2']
    }
  ];

  const result = resolveMusicArchiveMatch(profile, candidates, { minScore: 100, ambiguityGap: 500 });

  assert.equal(result.status, 'ambiguous');
  assert.equal(result.candidates.length, 2);
  assert.ok(result.candidates[0].score >= result.candidates[1].score);
});
