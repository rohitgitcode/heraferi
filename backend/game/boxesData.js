const BOX_POOL = [
  // JACKPOTS (+Cash)
  { id: 'j1', title: 'Kohinoor Ka Tukda', type: 'jackpot', value: 800, description: 'Asli heera! Seedha +₹800 ka munafa.' },
  { id: 'j2', title: 'Ambani Ka Blank Cheque', type: 'jackpot', value: 1000, description: 'Jackpot! +₹1000 aapke wallet mein.' },
  { id: 'j3', title: 'Purani Tijori Ki Chaabi', type: 'jackpot', value: 600, description: 'Andar se +₹600 cash nikla!' },
  { id: 'j4', title: 'Sone Ka Biscuit', type: 'jackpot', value: 700, description: '24 Carat shuddh munafa: +₹700.' },
  { id: 'j5', title: 'Gupt Khazana', type: 'jackpot', value: 500, description: 'Chota par solid profit: +₹500.' },

  // BOMBS / CHUNA (-Cash)
  { id: 'b1', title: 'Income Tax Raid!', type: 'bomb', value: -600, description: 'Pakde gaye! Seedha -₹600 ka fine.' },
  { id: 'b2', title: 'Phata Hua Purana Joota', type: 'bomb', value: -400, description: 'Bura chuna laga! -₹400 ka nuksaan.' },
  { id: 'b3', title: 'Nakli Note Ki Gaddi', type: 'bomb', value: -500, description: 'Police ne pakad liya! -₹500 penalty.' },
  { id: 'b4', title: 'Khali Dabba', type: 'bomb', value: -300, description: 'Andar hawa bhari thi! -₹300 waste.' },
  { id: 'b5', title: 'Share Market Crash', type: 'bomb', value: -700, description: 'Sab doob gaya! -₹700 ka jhatka.' },

  // SPECIAL TWISTS
  { id: 's1', title: 'Jeb Katra (Pickpocket)', type: 'steal', value: 300, description: 'Sabse ameer player ki jeb se ₹300 chori hokar aapko milenge!' },
  { id: 's2', title: 'Double Dhamaka (2x)', type: 'double', value: 0, description: 'Aapka current wallet cash seedha 1.5x (50% bonus) ho gaya!' },
  { id: 's3', title: 'Nazar Lag Gayi', type: 'halve', value: 0, description: 'Buri nazar! Aapke wallet ka 25% paisa ud gaya.' }
];

function getRandomBoxes(count = 1) {
  const shuffled = [...BOX_POOL].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

module.exports = { BOX_POOL, getRandomBoxes };