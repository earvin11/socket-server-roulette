const bets = {
  PLENO: 'plenoNumbers',
  SEMI_PLENO: 'semiPlenoNumbers',
  CALLE: 'calleNumbers',
  CUADRO: 'cuadroNumbers',
  LINEA: 'lineaNumbers',
  EVEN_ODD: 'even_odd',
  COLOR: 'color',
  COLUMN: 'columns',
  DOZEN: 'dozens',
  CHANCE_SIMPLE: 'chanceSimple',
  CUBRE: 'cubre',
};

export interface NumberBet {
  number: number;
  amount: number;
}

export interface BetFieldsAmerican {
  plenoNumbers: NumberBet[];
  semiPlenoNumbers: NumberBet[];
  calleNumbers: NumberBet[];
  cuadroNumbers: NumberBet[];
  lineaNumbers: NumberBet[];
  even_odd: EvenOddBet[];
  color: ColorBet[];
  columns: ColumnBet[];
  dozens: DozenBet[];
  chanceSimple: ChanceSimpleBet[];
  cubre: CubreBet[];
  specialCalle: SpecialCalleBet[];
}

interface EvenOddBet {
  type: 'EVEN' | 'ODD';
  amount: number;
}
interface ColorBet {
  type: 'RED' | 'BLACK';
  amount: number;
}

interface ColumnBet {
  type: 'FIRST' | 'SECOND' | 'THIRD';
  amount: number;
}
interface DozenBet {
  type: 'FIRST' | 'SECOND' | 'THIRD';
  amount: number;
}
interface ChanceSimpleBet {
  type: '1-18' | '19-36';
  amount: number;
}
interface CubreBet {
  type: '0-1-2' | '0-37-2' | '37-2-3';
  amount: number;
}

interface SpecialCalleBet {
  type: '37-0-1-2-3';
  amount: number;
}

const useCalculateAmountNumbers = (
  numbers: NumberBet[],
  iteratorNumber: number,
) => {
  let amount = 0;
  for (let i = 0; i <= numbers.length - iteratorNumber; i += iteratorNumber) {
    const currentBet = numbers[i];

    amount += currentBet.amount;
  }

  return amount;
};

const useCompareAmountNumbers = (
  numbers: NumberBet[],
  iteratorNumber: number,
) => {
  // first validation, if the array divisible between the iterator ejem: semiplenos has to be divisible between 2
  let isValidBet = true;
  const isDivisible = numbers.length % iteratorNumber === 0;
  if (!isDivisible) {
    return false;
  }

  for (let i = 0; i <= numbers.length - iteratorNumber; i += iteratorNumber) {
    const numbersToCompare = numbers.slice(i, i + iteratorNumber);

    const sameAmountInArr = Boolean(
      numbersToCompare.filter((n) => n.amount === numbersToCompare[0].amount)
        .length === iteratorNumber,
    );

    if (!sameAmountInArr) {
      // the bet is invalid, the user is problably trying to hack the sistem
      isValidBet = false;
    }
  }

  return isValidBet;
};

export const useCalculateTotalAmount = (bet: BetFieldsAmerican) => {
  let totalAmountInBet: number = 0;

  Object.keys(bet).forEach((keyBet) => {
    switch (keyBet) {
      case bets.SEMI_PLENO: {
        const amount = useCalculateAmountNumbers(bet[bets.SEMI_PLENO], 2);
        totalAmountInBet += amount;
        break;
      }
      case bets.CALLE: {
        const amount = useCalculateAmountNumbers(bet[bets.CALLE], 3);
        totalAmountInBet += amount;
        break;
      }
      case bets.CUADRO: {
        const amount = useCalculateAmountNumbers(bet[bets.CUADRO], 4);
        totalAmountInBet += amount;
        break;
      }
      case bets.LINEA: {
        const amount = useCalculateAmountNumbers(bet[bets.LINEA], 6);
        totalAmountInBet += amount;
        break;
      }

      default: {
        const currentBetArr = bet[keyBet];
        currentBetArr.forEach(({ amount }) => {
          totalAmountInBet += amount;
        });
      }
    }
  });

  // return totalAmountInBet;
  return parseFloat(totalAmountInBet.toFixed(2));
};

const validationAntiHacks = (bet: BetFieldsAmerican) => {
  let isValidBet = true;
  Object.keys(bet).forEach((keyBet) => {
    switch (keyBet) {
      case bets.SEMI_PLENO: {
        if (bet[bets.SEMI_PLENO].length) {
          const isValid = useCompareAmountNumbers(bet[bets.SEMI_PLENO], 2);

          if (!isValid) {
            isValidBet = false;
          }
        }

        break;
      }
      case bets.CALLE: {
        if (bet[bets.CALLE].length) {
          const isValid = useCompareAmountNumbers(bet[bets.CALLE], 3);

          if (!isValid) {
            isValidBet = false;
          }
        }

        break;
      }
      case bets.CUADRO: {
        if (bet[bets.CUADRO].length) {
          const isValid = useCompareAmountNumbers(bet[bets.CUADRO], 4);

          if (!isValid) {
            isValidBet = false;
          }
        }

        break;
      }
      case bets.LINEA: {
        if (bet[bets.LINEA].length) {
          const isValid = useCompareAmountNumbers(bet[bets.LINEA], 6);

          if (!isValid) {
            isValidBet = false;
          }
        }

        break;
      }
    }
  });

  return isValidBet;
};

export const isValidBet = (bet: BetFieldsAmerican): boolean => {
  const {
    calleNumbers,
    chanceSimple,
    color,
    columns,
    cuadroNumbers,
    cubre,
    dozens,
    even_odd,
    lineaNumbers,
    plenoNumbers,
    semiPlenoNumbers,
    specialCalle,
  } = bet;

  const validation = validationAntiHacks(bet);
  if (!validation) {
    return false;
  }

  if (color.length === 2) {
    return false;
  }

  if (even_odd.length === 2) {
    return false;
  }

  if (chanceSimple.length === 2) {
    return false;
  }

  if (
    !plenoNumbers.length &&
    !semiPlenoNumbers.length &&
    !lineaNumbers.length &&
    !cuadroNumbers.length &&
    !dozens.length &&
    !columns.length &&
    !color.length &&
    !even_odd.length &&
    !chanceSimple.length &&
    !cubre.length &&
    !specialCalle.length &&
    !calleNumbers.length
  ) {
    return false;
  } else {
    return true;
  }
};
