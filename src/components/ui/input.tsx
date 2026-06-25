import React from 'react';

const Input = ({ className = "", ...props }) => (
  <input 
    className={`w-full px-3 py-2 rounded-lg border border-white/20 bg-card/50 text-white focus:outline-none focus:border-emerald-500 ${className}`}
    {...props}
  />
);

export default Input;
export { Input };