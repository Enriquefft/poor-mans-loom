export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg 
      width="24" 
      height="24" 
      viewBox="0 0 32 32" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect x="2" y="6" width="28" height="20" stroke="currentColor" strokeWidth="2"/>
      <circle cx="16" cy="16" r="4" fill="#dc2626"/>
      <rect x="6" y="10" width="4" height="4" fill="currentColor" opacity="0.3"/>
    </svg>
  )
}

