// ==========================================
// QUOTE OF THE DAY
// A built-in collection, so it works offline and never depends on an outside service.
// Picks, in order: a special date or holiday, then a quote that fits the day of the work week,
// then a general quote. The same date always gives the same quote.
// ==========================================

// Fixed-date occasions, keyed by "MM-DD"
const QUOTE_OCCASIONS = {
  '01-01': { occasion: '🎆 New Year', text: 'For last year\'s words belong to last year\'s language, and next year\'s words await another voice.', author: 'T. S. Eliot' },
  '01-07': { occasion: '🎄 Coptic Christmas', text: 'On earth peace, good will toward men.', author: 'Luke 2:14' },
  '03-08': { occasion: '💜 International Women\'s Day', text: 'We cannot all succeed when half of us are held back.', author: 'Malala Yousafzai' },
  '03-20': { occasion: '😊 International Day of Happiness', text: 'Happiness is not something ready made. It comes from your own actions.', author: 'Dalai Lama' },
  '03-21': { occasion: '💐 Mother\'s Day', text: 'Mother is the name for God in the lips and hearts of little children.', author: 'William Makepeace Thackeray' },
  '04-22': { occasion: '🌍 Earth Day', text: 'We do not inherit the earth from our ancestors; we borrow it from our children.', author: 'Proverb' },
  '05-01': { occasion: '🛠️ Labour Day', text: 'Nothing will work unless you do.', author: 'Maya Angelou' },
  '09-08': { occasion: '📖 International Literacy Day', text: 'Once you learn to read, you will be forever free.', author: 'Frederick Douglass' },
  '09-21': { occasion: '🕊️ International Day of Peace', text: 'Peace begins with a smile.', author: 'Mother Teresa' },
  '10-05': { occasion: '🍎 World Teachers\' Day', text: 'A teacher affects eternity; he can never tell where his influence stops.', author: 'Henry Adams' },
  '10-10': { occasion: '💚 World Mental Health Day', text: 'There is hope, even when your brain tells you there isn\'t.', author: 'John Green' },
  '11-13': { occasion: '🤝 World Kindness Day', text: 'No act of kindness, no matter how small, is ever wasted.', author: 'Aesop' },
  '12-10': { occasion: '⚖️ Human Rights Day', text: 'All human beings are born free and equal in dignity and rights.', author: 'Universal Declaration of Human Rights' },
  '12-31': { occasion: '✨ New Year\'s Eve', text: 'Ring out the old, ring in the new.', author: 'Alfred, Lord Tennyson' }
};

// Holidays that move each year (Islamic calendar, and Coptic Easter for Sham el-Nessim)
const QUOTE_MOVABLE = {
  ramadanStart: { occasion: '🌙 Ramadan Kareem', text: 'Patience is the key to relief.', author: 'Arabic proverb' },
  ramadan: { occasion: '🌙 Ramadan', text: 'Seek knowledge from the cradle to the grave.', author: 'Arabic saying' },
  eidFitr: { occasion: '🎉 Eid al-Fitr Mubarak', text: 'Shared joy is a double joy.', author: 'Swedish proverb' },
  eidAdha: { occasion: '🐑 Eid al-Adha Mubarak', text: 'No act of kindness, no matter how small, is ever wasted.', author: 'Aesop' },
  hijriNewYear: { occasion: '🌙 Islamic New Year', text: 'What we call the beginning is often the end. And to make an end is to make a beginning.', author: 'T. S. Eliot' },
  shamElNessim: { occasion: '🌸 Sham el-Nessim', text: 'Spring is nature\'s way of saying, "Let\'s party!"', author: 'Robin Williams' }
};

// First day of the work week: fresh starts
const QUOTES_START = [
  { text: 'Well begun is half done.', author: 'Aristotle' },
  { text: 'The journey of a thousand miles begins with a single step.', author: 'Lao Tzu' },
  { text: 'Begin at once to live.', author: 'Seneca' },
  { text: 'Start where you are. Use what you have. Do what you can.', author: 'Arthur Ashe' },
  { text: 'First say to yourself what you would be; and then do what you have to do.', author: 'Epictetus' },
  { text: 'Write it on your heart that every day is the best day in the year.', author: 'Ralph Waldo Emerson' },
  { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese proverb' },
  { text: 'How wonderful it is that nobody need wait a single moment before starting to improve the world.', author: 'Anne Frank' },
  { text: 'You don\'t have to be great to start, but you have to start to be great.', author: 'Zig Ziglar' },
  { text: 'What we call the beginning is often the end. And to make an end is to make a beginning.', author: 'T. S. Eliot' },
  { text: 'The creation of a thousand forests is in one acorn.', author: 'Ralph Waldo Emerson' },
  { text: 'Make each day your masterpiece.', author: 'John Wooden' },
  { text: 'You can\'t cross the sea merely by standing and staring at the water.', author: 'Rabindranath Tagore' }
];

// Last day of the work week: finishing well
const QUOTES_FINISH = [
  { text: 'Finish each day and be done with it. You have done what you could. Tomorrow is a new day.', author: 'Ralph Waldo Emerson' },
  { text: 'The reward of a thing well done is to have done it.', author: 'Ralph Waldo Emerson' },
  { text: 'Well done is better than well said.', author: 'Benjamin Franklin' },
  { text: 'It is not the mountain we conquer, but ourselves.', author: 'Edmund Hillary' },
  { text: 'Energy and persistence conquer all things.', author: 'Benjamin Franklin' },
  { text: 'Success is the sum of small efforts, repeated day in and day out.', author: 'Robert Collier' },
  { text: 'The best way out is always through.', author: 'Robert Frost' },
  { text: 'Small deeds done are better than great deeds planned.', author: 'Peter Marshall' },
  { text: 'Don\'t count the days, make the days count.', author: 'Muhammad Ali' },
  { text: 'Fall seven times, stand up eight.', author: 'Japanese proverb' },
  { text: 'Courage is grace under pressure.', author: 'Ernest Hemingway' }
];

// Weekend: rest and recharge
const QUOTES_REST = [
  { text: 'Rest is not idleness.', author: 'John Lubbock' },
  { text: 'Almost everything will work again if you unplug it for a few minutes, including you.', author: 'Anne Lamott' },
  { text: 'Take rest; a field that has rested gives a bountiful crop.', author: 'Ovid' },
  { text: 'There is virtue in work and there is virtue in rest. Use both and overlook neither.', author: 'Alan Cohen' },
  { text: 'Instructions for living a life: Pay attention. Be astonished. Tell about it.', author: 'Mary Oliver' },
  { text: 'Every delay holds something good.', author: 'Egyptian proverb' },
  { text: 'Patience is the key to relief.', author: 'Arabic proverb' },
  { text: 'Try to be a rainbow in someone\'s cloud.', author: 'Maya Angelou' },
  { text: 'If you want the rainbow, you gotta put up with the rain.', author: 'Dolly Parton' },
  { text: 'Tell me, what is it you plan to do with your one wild and precious life?', author: 'Mary Oliver' },
  { text: 'If you want to go fast, go alone. If you want to go far, go together.', author: 'African proverb' }
];

// Every other day: focus, planning and encouragement
const QUOTES_GENERAL = [
  { text: 'How we spend our days is, of course, how we spend our lives.', author: 'Annie Dillard' },
  { text: 'The key is not to prioritize what\'s on your schedule, but to schedule your priorities.', author: 'Stephen R. Covey' },
  { text: 'Your mind is for having ideas, not holding them.', author: 'David Allen' },
  { text: 'Plans are worthless, but planning is everything.', author: 'Dwight D. Eisenhower' },
  { text: 'Efficiency is doing things right; effectiveness is doing the right things.', author: 'Peter Drucker' },
  { text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', author: 'Will Durant' },
  { text: 'Knowing is not enough; we must apply. Willing is not enough; we must do.', author: 'Johann Wolfgang von Goethe' },
  { text: 'Do what you can, with what you have, where you are.', author: 'Theodore Roosevelt' },
  { text: 'Discipline is the bridge between goals and accomplishment.', author: 'Jim Rohn' },
  { text: 'Lost time is never found again.', author: 'Benjamin Franklin' },
  { text: 'While we are postponing, life speeds by.', author: 'Seneca' },
  { text: 'Waste no more time arguing what a good man should be. Be one.', author: 'Marcus Aurelius' },
  { text: 'He who has a why to live can bear almost any how.', author: 'Friedrich Nietzsche' },
  { text: 'When we are no longer able to change a situation, we are challenged to change ourselves.', author: 'Viktor E. Frankl' },
  { text: 'You must do the thing you think you cannot do.', author: 'Eleanor Roosevelt' },
  { text: 'Optimism is the faith that leads to achievement.', author: 'Helen Keller' },
  { text: 'Alone we can do so little; together we can do so much.', author: 'Helen Keller' },
  { text: 'I am not afraid of storms, for I am learning how to sail my ship.', author: 'Louisa May Alcott' },
  { text: 'Nothing in life is to be feared, it is only to be understood.', author: 'Marie Curie' },
  { text: 'The most effective way to do it, is to do it.', author: 'Amelia Earhart' },
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'You miss 100% of the shots you don\'t take.', author: 'Wayne Gretzky' },
  { text: 'Either write something worth reading or do something worth writing.', author: 'Benjamin Franklin' },
  { text: 'Happiness is not something ready made. It comes from your own actions.', author: 'Dalai Lama' },
  { text: 'Seek knowledge from the cradle to the grave.', author: 'Arabic saying' },
  { text: 'Stay hungry, stay foolish.', author: 'Steve Jobs' },
  { text: 'Nothing will work unless you do.', author: 'Maya Angelou' }
];

// Day number since 1970 for a "YYYY-MM-DD" date, independent of time zone
function quoteDayNumber(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

// Islamic (Umm al-Qura) month and day for a date; Egypt's moon sighting can differ by a day
function hijriMonthDay(ymd) {
  try {
    const [y, m, d] = ymd.split('-').map(Number);
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { month: 'numeric', day: 'numeric', timeZone: 'UTC' })
      .formatToParts(new Date(Date.UTC(y, m - 1, d, 12)));
    const get = type => Number((parts.find(p => p.type === type) || {}).value);
    return { month: get('month'), day: get('day') };
  } catch (e) {
    return null;
  }
}

// Orthodox (Coptic) Easter as "YYYY-MM-DD" in the Gregorian calendar (Meeus' Julian algorithm)
function orthodoxEaster(year) {
  const a = year % 4, b = year % 7, c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  // Julian → Gregorian offset is 13 days for 1900–2099
  const date = new Date(Date.UTC(year, month - 1, day + 13));
  return date.toISOString().slice(0, 10);
}

function movableOccasion(ymd) {
  const year = Number(ymd.slice(0, 4));
  const easter = orthodoxEaster(year);
  const [ey, em, ed] = easter.split('-').map(Number);
  if (new Date(Date.UTC(ey, em - 1, ed + 1)).toISOString().slice(0, 10) === ymd) return QUOTE_MOVABLE.shamElNessim;

  const h = hijriMonthDay(ymd);
  if (!h) return null;
  if (h.month === 1 && h.day === 1) return QUOTE_MOVABLE.hijriNewYear;
  if (h.month === 9 && h.day === 1) return QUOTE_MOVABLE.ramadanStart;
  if (h.month === 10 && h.day === 1) return QUOTE_MOVABLE.eidFitr;
  if (h.month === 12 && h.day === 10) return QUOTE_MOVABLE.eidAdha;
  if (h.month === 9) {
    // Through Ramadan, rotate the weekday quotes but keep the Ramadan label
    return { ...QUOTES_GENERAL[quoteDayNumber(ymd) % QUOTES_GENERAL.length], occasion: QUOTE_MOVABLE.ramadan.occasion };
  }
  return null;
}

// workDays: weekday numbers (0 = Sunday) that are work days, in order
function getQuoteOfTheDay(ymd, workDays = [0, 1, 2, 3, 4]) {
  // Religious holidays (e.g. Eid) win over fixed observance days that happen to share the date
  const special = movableOccasion(ymd) || QUOTE_OCCASIONS[ymd.slice(5)];
  if (special) return special;

  const dayNum = quoteDayNumber(ymd);
  const weekday = (dayNum + 4) % 7; // 1970-01-01 was a Thursday
  const weekNum = Math.floor((dayNum + 4) / 7);
  let pool = QUOTES_GENERAL;
  let index = dayNum;
  if (!workDays.includes(weekday)) {
    pool = QUOTES_REST;
    index = weekNum * 2 + (weekday === 6 ? 1 : 0); // Friday and Saturday get different quotes
  } else if (weekday === workDays[0]) {
    pool = QUOTES_START;
    index = weekNum;
  } else if (weekday === workDays[workDays.length - 1]) {
    pool = QUOTES_FINISH;
    index = weekNum;
  }
  return pool[((index % pool.length) + pool.length) % pool.length];
}
