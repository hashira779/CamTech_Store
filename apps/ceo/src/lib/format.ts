export const money = (n: number, dp = 2) =>
  `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;

export const compactMoney = (n: number) =>
  `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export const num = (n: number) => Number(n || 0).toLocaleString();
