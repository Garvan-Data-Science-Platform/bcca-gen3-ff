import React from 'react';

const UnderDevelopmentBanner = () => {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="w-full bg-amber-400 text-black text-center text-sm font-semibold py-2 px-4 border-b border-amber-600 z-50"
    >
      <span className="inline-block mr-2" aria-hidden="true">
        &#9888;
      </span>
      This portal is under active development. Data, features, and access may
      change without notice.
    </div>
  );
};

export default UnderDevelopmentBanner;
