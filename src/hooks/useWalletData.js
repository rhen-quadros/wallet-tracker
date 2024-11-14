import { useState, useEffect } from 'react';
import { fetchWalletData } from '../utils/solana';

export const useWalletData = (addresses) => {
  const [walletData, setWalletData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!addresses.length) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const data = {};
        for (const address of addresses) {
          const walletInfo = await fetchWalletData(address);
          data[address] = walletInfo;
        }
        setWalletData(data);
      } catch (err) {
        setError(err.message);
        console.error('Error fetching wallet data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [addresses]);

  return { walletData, loading, error };
}; 