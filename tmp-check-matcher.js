const { getBranoMatchProfile, resolveMusicArchiveMatch } = require('./Bordero/server/music-archive-match');
const profile = getBranoMatchProfile({ id: '', titolo: 'Boot Scootin Boogie', coreografia: 'Boot Scootin Boogie', brano: 'Boot Scootin Boogie' });
const candidates = [
  { baseName: 'Boot Scootin Boogie', normalizedName: 'boot scootin boogie', tokens: ['boot', 'scootin', 'boogie'] },
  { baseName: 'Boot Scootin Boogie 2', normalizedName: 'boot scootin boogie 2', tokens: ['boot', 'scootin', 'boogie', '2'] }
];
console.log(JSON.stringify({ profile, result: resolveMusicArchiveMatch(profile, candidates, { minScore: 100, ambiguityGap: 40 }) }, null, 2));
