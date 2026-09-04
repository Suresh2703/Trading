import React, { createContext, useState, useEffect, useContext } from 'react';

const CurrencyContext = createContext();

export const CurrencyProvider = ({ children }) => {
  const [currency, setCurrency] = useState('USD');
  const [symbol, setSymbol] = useState('$');

  const updateCurrency = (newCurrency) => {
    setCurrency(newCurrency);
    switch (newCurrency) {
      case 'EUR':
        setSymbol('€');
        break;
      case 'GBP':
        setSymbol('£');
        break;
      case 'INR':
        setSymbol('₹');
        break;
      case 'USD':
      default:
        setSymbol('$');
        break;
    }
    localStorage.setItem('app_currency', newCurrency);
  };

  useEffect(() => {
    const saved = localStorage.getItem('app_currency');
    if (saved) {
      updateCurrency(saved);
    }
  }, []);

  return (
    <CurrencyContext.Provider value={{ currency, symbol, updateCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => useContext(CurrencyContext);
