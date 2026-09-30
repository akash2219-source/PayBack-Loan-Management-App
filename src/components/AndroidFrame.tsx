import React from 'react';

export const AndroidFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen w-full bg-[#090D16] text-slate-100 flex flex-col items-center justify-start selection:bg-indigo-500 selection:text-white overflow-x-hidden">
      <div className="w-full max-w-[440px] min-h-screen bg-[#0F172A] shadow-2xl relative flex flex-col flex-1 overflow-x-hidden">
        {children}
      </div>
    </div>
  );
};
