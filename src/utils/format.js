export const formatAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

export const formatUSD = (amount) => {
  if (!amount) return "$0.00";
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatSolBalance = (balance) => {
  if (!balance) return "0";
  const solBalance = Number(balance) / LAMPORTS_PER_SOL;
  return solBalance.toFixed(3);
}; 